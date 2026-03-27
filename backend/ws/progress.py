from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections grouped by download ID."""

    _instance: ConnectionManager | None = None

    def __new__(cls) -> ConnectionManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.active_connections: dict[str, list[WebSocket]] = {}
        return cls._instance

    async def connect(self, download_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(download_id, []).append(websocket)

    def disconnect(self, download_id: str, websocket: WebSocket) -> None:
        conns = self.active_connections.get(download_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns and download_id in self.active_connections:
            del self.active_connections[download_id]

    async def broadcast(self, download_id: str, data: dict[str, Any]) -> None:
        conns = self.active_connections.get(download_id, [])
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(download_id, ws)
