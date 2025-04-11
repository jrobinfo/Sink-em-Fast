// socket.io-mock.d.ts
declare module 'socket.io-mock' {
    import { EventEmitter } from 'events';
    import { Socket as ClientSocket } from 'socket.io-client'; // Use type from actual client

    class SocketMock extends EventEmitter {
        id: string;
        constructor();
        socketClient: ClientSocket; // Use actual client socket type
        emit(event: string, ...args: any[]): boolean;
        emitTo(roomOrID: string, event: string, ...args: any[]): void;
        join(room: string | string[]): void;
        leave(room: string): void;
        // Add other methods/properties as needed based on usage
    }
    export default SocketMock;
} 