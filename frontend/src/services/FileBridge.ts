import WebRTCManager from './WebRTCManager';

/**
 * File Bridge
 * 
 * Handles file transfer between devices:
 * - Browse remote filesystem (sandboxed)
 * - Upload/download files
 * - Chunked transfer for large files
 * - Progress tracking
 * - Cancellation support
 */
export default class FileBridge {
  private webrtcManager: WebRTCManager;
  private activeTransfers: Map<string, FileTransfer> = new Map();
  private readonly CHUNK_SIZE = 64 * 1024; // 64KB chunks

  constructor(webrtcManager: WebRTCManager) {
    this.webrtcManager = webrtcManager;
  }

  /**
   * Send file to target device
   */
  async sendFile(
    file: File,
    targetDeviceId: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transfer: FileTransfer = {
      id: transferId,
      file,
      targetDeviceId,
      totalSize: file.size,
      transferred: 0,
      onProgress,
      cancelled: false,
    };

    this.activeTransfers.set(transferId, transfer);

    // Send file metadata first
    await this.webrtcManager.sendIntent({
      intent_type: 'file_handoff',
      payload: {
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      },
      target_device: targetDeviceId,
      source_device: '',
      auto_open: true,
      timestamp: Date.now(),
    });

    // Transfer file in chunks via WebRTC data channel
    await this.transferFileChunks(transfer);
  }

  /**
   * Transfer file in chunks
   */
  private async transferFileChunks(transfer: FileTransfer): Promise<void> {
    const reader = new FileReader();
    let offset = 0;
    let chunkIndex = 0;

    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        if (transfer.cancelled) {
          reject(new Error('Transfer cancelled'));
          return;
        }

        const chunk = e.target?.result as ArrayBuffer;
        
        // Send chunk via WebRTC
        try {
          await this.sendChunk(transfer.id, chunkIndex, chunk, transfer.targetDeviceId);
          
          transfer.transferred += chunk.byteLength;
          transfer.onProgress?.(
            Math.round((transfer.transferred / transfer.totalSize) * 100)
          );

          offset += chunk.byteLength;
          chunkIndex++;

          if (offset < transfer.totalSize) {
            // Read next chunk
            const nextChunk = file.slice(offset, offset + this.CHUNK_SIZE);
            reader.readAsArrayBuffer(nextChunk);
          } else {
            // Transfer complete
            await this.sendTransferComplete(transfer.id, transfer.targetDeviceId);
            this.activeTransfers.delete(transfer.id);
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file chunk'));
      };

      // Start reading first chunk
      const file = transfer.file;
      const firstChunk = file.slice(0, this.CHUNK_SIZE);
      reader.readAsArrayBuffer(firstChunk);
    });
  }

  /**
   * Send a file chunk via WebRTC
   */
  private async sendChunk(
    transferId: string,
    chunkIndex: number,
    chunk: ArrayBuffer,
    targetDeviceId: string
  ): Promise<void> {
    // In a real implementation, this would use WebRTC data channel
    // For now, we'll use the WebRTCManager's sendIntent as a fallback
    // In production, implement dedicated binary data channel transfer
    
    const message = {
      type: 'file_chunk',
      transferId,
      chunkIndex,
      chunk: Array.from(new Uint8Array(chunk)), // Convert to array for JSON
      isLast: false,
    };

    // This is a simplified version - in production, use binary data channels
    await this.webrtcManager.sendIntent({
      intent_type: 'file_handoff',
      payload: {
        file: {
          name: '', // Already sent in metadata
          size: chunk.byteLength,
          type: 'application/octet-stream',
          data: chunk,
        },
      },
      target_device: targetDeviceId,
      source_device: '',
      auto_open: false,
      timestamp: Date.now(),
    });
  }

  /**
   * Send transfer complete notification
   */
  private async sendTransferComplete(
    transferId: string,
    targetDeviceId: string
  ): Promise<void> {
    // Notify target device that transfer is complete
    await this.webrtcManager.sendIntent({
      intent_type: 'file_handoff',
      payload: {
        file: {
          name: '',
          size: 0,
          type: 'application/x-flowlink-transfer-complete',
        },
      },
      target_device: targetDeviceId,
      source_device: '',
      auto_open: false,
      timestamp: Date.now(),
    });
  }

  /**
   * Cancel active transfer
   */
  cancelTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      transfer.cancelled = true;
      this.activeTransfers.delete(transferId);
    }
  }

  /**
   * Browse remote device filesystem (sandboxed)
   */
  async browseRemoteFilesystem(
    targetDeviceId: string,
    path: string = '/'
  ): Promise<FileSystemEntry[]> {
    // Request file listing from remote device
    // This would require a dedicated API on the device agent
    // For MVP, return empty array
    return [];
  }
}

interface FileTransfer {
  id: string;
  file: File;
  targetDeviceId: string;
  totalSize: number;
  transferred: number;
  onProgress?: (progress: number) => void;
  cancelled: boolean;
}

interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

