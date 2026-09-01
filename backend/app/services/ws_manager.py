import asyncio
import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Tiny in-memory manager — fine for a single-elder demo. Broadcasts JSON events to every
    connected companion client."""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
        self._loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)
        self._loop = asyncio.get_running_loop()

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, event: dict[str, Any]) -> None:
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def broadcast_threadsafe(self, event: dict[str, Any]) -> None:
        """Called from the APScheduler background thread, which has no running event loop."""
        if self._loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.broadcast(event), self._loop)


manager = ConnectionManager()
