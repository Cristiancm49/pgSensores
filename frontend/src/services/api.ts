export const apiUrl = import.meta.env.VITE_API_URL ?? ''
const tokenKey = 'nexiot_access_token'

export class ApiError extends Error {
  status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)
    this.status = status
  }
}

function notify(type: 'success' | 'error', message: string) {
  window.dispatchEvent(new CustomEvent('nexiot:notification', { detail: { type, message } }))
}

export function getAccessToken() {
  return sessionStorage.getItem(tokenKey)
}

export function setAccessToken(token: string | null) {
  if (token) sessionStorage.setItem(tokenKey, token)
  else sessionStorage.removeItem(tokenKey)
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail ?? `Error HTTP ${response.status}`
  } catch {
    return `Error HTTP ${response.status}`
  }
}

export async function refreshAccessToken<TUser = unknown>() {
  const response = await fetch(`${apiUrl}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    setAccessToken(null)
    throw new ApiError(response.status, await readError(response))
  }
  const payload = (await response.json()) as { access_token: string; user: TUser }
  setAccessToken(payload.access_token)
  return payload
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
  silent = false,
): Promise<T> {
  const token = getAccessToken()
  const isFormData = init?.body instanceof FormData
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (
    response.status === 401 &&
    allowRefresh &&
    !path.startsWith('/api/auth/')
  ) {
    await refreshAccessToken()
    return apiRequest<T>(path, init, false, silent)
  }
  if (!response.ok) {
    const message = await readError(response)
    if (!silent) notify('error', message)
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function apiDownload(path: string, allowRefresh = true, silent = false): Promise<Blob> {
  const token = getAccessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (response.status === 401 && allowRefresh) {
    await refreshAccessToken()
    return apiDownload(path, false, silent)
  }
  if (!response.ok) {
    const message = await readError(response)
    if (!silent) notify('error', message)
    throw new ApiError(response.status, message)
  }
  return response.blob()
}

export function uploadWithProgress<T>(
  path: string,
  data: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${apiUrl}${path}`)
    const token = getAccessToken()
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onerror = () => reject(new ApiError(0, 'No fue posible subir el archivo'))
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        notify('success', 'Archivo cargado correctamente')
        resolve(JSON.parse(request.responseText) as T)
        return
      }
      try {
        const body = JSON.parse(request.responseText) as { detail?: string }
        const message = body.detail ?? `Error HTTP ${request.status}`
        notify('error', message)
        reject(new ApiError(request.status, message))
      } catch {
        reject(new ApiError(request.status, `Error HTTP ${request.status}`))
      }
    }
    request.send(data)
  })
}
