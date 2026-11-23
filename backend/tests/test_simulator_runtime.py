from app.services.simulator_runtime import (
    board_profiles,
    calculate_signal,
    component_catalog,
    default_signal,
    starter_kit_channels,
    starter_kits,
)


def test_board_profiles_include_arduino_and_esp32() -> None:
    profile_ids = {profile["id"] for profile in board_profiles()}
    assert {
        "arduino_uno",
        "arduino_mega",
        "esp32_devkit",
        "raspberry_pico_w",
        "raspberry_pi_4",
        "custom_board",
    } <= profile_ids


def test_starter_kits_always_include_a_sensor() -> None:
    for kit in starter_kits():
        assert kit["sensor_count"] >= 1
        channels = starter_kit_channels(kit["id"])
        assert any(channel["category"] == "sensor" for channel in channels)
        assert all(channel["gpio"].startswith("V") for channel in channels)


def test_components_can_be_selected_individually() -> None:
    component_ids = {component["id"] for component in component_catalog()}
    assert {"temperatura", "distancia", "servo", "bomba_riego"} <= component_ids
    channels = starter_kit_channels("basic", ["distancia", "servo"])
    assert [channel["key"] for channel in channels] == ["distancia", "servo"]


def test_temperature_signal_is_bounded_and_reproducible() -> None:
    channel = {
        "id": "channel-1",
        "key": "temperatura",
        "name": "Temperatura ambiente",
        "data_type": "numero",
        "unit": "°C",
        "gpio": "A0",
        "minimum_value": 0,
        "maximum_value": 50,
    }
    signal = default_signal(channel)
    first = calculate_signal(signal, elapsed=12.5, noise=0.03)
    second = calculate_signal(signal, elapsed=12.5, noise=0.03)
    assert first == second
    assert 0 <= first <= 50


def test_boolean_signal_changes_with_period() -> None:
    signal = {"data_type": "booleano", "period_seconds": 2}
    assert calculate_signal(signal, elapsed=0, noise=0) is True
    assert calculate_signal(signal, elapsed=2.1, noise=0) is False
