FROM ubuntu:24.04

ARG ARDUINO_CLI_VERSION=1.3.1
ARG RENODE_VERSION=1.17.0
ARG RENODE_SHA256=4ba7c68b59e2447f188ef4b4b112fcccd2802582c460beedceb63b84e5605a5f

ENV ARDUINO_DIRECTORIES_DATA=/opt/arduino/data \
    ARDUINO_DIRECTORIES_DOWNLOADS=/tmp/arduino-downloads \
    ARDUINO_DIRECTORIES_USER=/opt/arduino/user

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl python3 simavr \
    && curl --fail --location --silent --show-error \
        "https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz" \
        | tar -xz -C /usr/local/bin arduino-cli \
    && mkdir -p /opt/arduino/data /opt/arduino/user /tmp/arduino-downloads \
    && arduino-cli config init \
    && arduino-cli core update-index \
    && arduino-cli core install arduino:avr \
    && mkdir -p /opt/renode \
    && curl --fail --location --silent --show-error \
        "https://github.com/renode/renode/releases/download/v${RENODE_VERSION}/renode-${RENODE_VERSION}.linux-portable.tar.gz" \
        -o /tmp/renode.tar.gz \
    && echo "${RENODE_SHA256}  /tmp/renode.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/renode.tar.gz -C /opt/renode --strip-components=1 \
    && rm /tmp/renode.tar.gz \
    && chmod -R a+rX /opt/arduino /opt/renode \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.py /opt/firmware-runner/entrypoint.py

USER 65534:65534
ENTRYPOINT ["python3", "/opt/firmware-runner/entrypoint.py"]
