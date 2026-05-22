from __future__ import annotations

import os

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration


def init_sentry(dsn: str) -> None:
    if not dsn:
        return

    environment = os.getenv("SENTRY_ENVIRONMENT", "development")
    is_dev = environment == "development"

    integrations = [
        StarletteIntegration(),
        FastApiIntegration(),
    ]

    try:
        from sentry_sdk.integrations.langgraph import LanggraphIntegration

        integrations.append(LanggraphIntegration())
    except Exception:
        pass

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        send_default_pii=True,
        traces_sample_rate=1.0 if is_dev else 0.1,
        enable_logs=True,
        integrations=integrations,
    )
