import { useState, useEffect, useRef, useCallback } from 'react'

interface UseWebSocketOptions {
  onMessage?: (data: any) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

interface UseWebSocketReturn {
  sendMessage: (data: any) => void
  lastMessage: any | null
  readyState: number
  connect: () => void
  disconnect: () => void
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onOpen,
    onClose,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options

  const [lastMessage, setLastMessage] = useState<any>(null)
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(autoReconnect)
  const urlRef = useRef(url)
  const optionsRef = useRef({ onMessage, onOpen, onClose })

  // Keep refs current
  urlRef.current = url
  shouldReconnectRef.current = autoReconnect
  optionsRef.current = { onMessage, onOpen, onClose }

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    clearReconnectTimer()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [clearReconnectTimer])

  const connect = useCallback(() => {
    const currentUrl = urlRef.current
    if (!currentUrl) return

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    shouldReconnectRef.current = autoReconnect

    const ws = new WebSocket(currentUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN)
      optionsRef.current.onOpen?.()
    }

    ws.onmessage = (event: MessageEvent) => {
      let data: any
      try {
        data = JSON.parse(event.data)
      } catch {
        data = event.data
      }
      setLastMessage(data)
      optionsRef.current.onMessage?.(data)
    }

    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED)
      optionsRef.current.onClose?.()

      if (shouldReconnectRef.current && urlRef.current) {
        clearReconnectTimer()
        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }

    ws.onerror = () => {
      // onerror is always followed by onclose, so we let onclose handle reconnect
      setReadyState(WebSocket.CLOSED)
    }

    setReadyState(WebSocket.CONNECTING)
  }, [autoReconnect, reconnectInterval, clearReconnectTimer])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data)
      wsRef.current.send(message)
    }
  }, [])

  // Connect/disconnect when url changes
  useEffect(() => {
    if (url) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      shouldReconnectRef.current = false
      clearReconnectTimer()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  return { sendMessage, lastMessage, readyState, connect, disconnect }
}
