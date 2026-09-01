from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/companion")
async def companion_socket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            # Companion client doesn't need to send anything; this just detects disconnects.
            await websocket.receive_text()
    except (WebSocketDisconnect, RuntimeError, ConnectionError):
        # A reset connection raises something other than WebSocketDisconnect; without this the
        # dead socket would linger in the manager until a later broadcast happened to evict it.
        pass
    finally:
        manager.disconnect(websocket)
