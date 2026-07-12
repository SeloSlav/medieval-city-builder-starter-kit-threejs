export type SessionConnectionState = 'connecting' | 'ready' | 'disconnected' | 'blocked';

export type SessionConnectionGateListener = () => void;

export class SessionConnectionGate {
  private state: SessionConnectionState = 'connecting';
  private blockedMessage: string | null = null;
  private hasReachedReady = false;
  private readonly listeners = new Set<SessionConnectionGateListener>();

  isReady(): boolean {
    return this.state === 'ready';
  }

  getState(): SessionConnectionState {
    return this.state;
  }

  getBlockedMessage(): string | null {
    return this.blockedMessage;
  }

  hasEverBeenReady(): boolean {
    return this.hasReachedReady;
  }

  markConnecting(): void {
    if (this.state === 'connecting') return;
    this.state = 'connecting';
    this.blockedMessage = null;
    this.notify();
  }

  markReady(): void {
    this.hasReachedReady = true;
    if (this.state === 'ready') return;
    this.state = 'ready';
    this.blockedMessage = null;
    this.notify();
  }

  markDisconnected(): void {
    if (this.state === 'disconnected') return;
    this.state = 'disconnected';
    this.blockedMessage = null;
    this.notify();
  }

  markBlocked(message: string): void {
    this.state = 'blocked';
    this.blockedMessage = message;
    this.notify();
  }

  subscribe(listener: SessionConnectionGateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
