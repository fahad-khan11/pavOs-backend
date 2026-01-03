import { whopMessageService } from '../services/whopMessageService.js';
import { Lead } from '../models/index.js';

/**
 * Poll Whop for new messages every 30 seconds
 * This is a workaround since Whop doesn't have message webhooks
 */
export class WhopMessagePoller {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollInterval = 30000; // 30 seconds

  /**
   * Start polling for new messages
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Message poller already running');
      return;
    }

    console.log('🔄 Starting Whop message poller (every 30 seconds)...');
    this.isRunning = true;

    // Poll immediately on start
    this.pollMessages();

    // Then poll every 30 seconds
    this.intervalId = setInterval(() => {
      this.pollMessages();
    }, this.pollInterval);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏹️  Message poller stopped');
    }
  }

  /**
   * Poll for new messages from all active Whop leads
   */
  private async pollMessages() {
    try {
      // Find all leads with Whop support channels
      const leadsWithChannels = await Lead.find({
        whopSupportChannelId: { $exists: true, $ne: null },
        source: 'whop',
      }).limit(50); // Limit to prevent API overload

      if (leadsWithChannels.length === 0) {
        return; // No active Whop conversations
      }

      console.log(`📊 Polling ${leadsWithChannels.length} Whop conversations for new messages...`);

      for (const lead of leadsWithChannels) {
        try {
          await whopMessageService.pollForNewMessages(
            lead._id.toString(),
            lead.whopCompanyId
          );
        } catch (error: any) {
          console.error(`❌ Error polling messages for lead ${lead._id}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Error in message poller:', error);
    }
  }

  /**
   * Change poll interval (in seconds)
   */
  setInterval(seconds: number) {
    this.pollInterval = seconds * 1000;
    
    // Restart if already running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Singleton instance
export const whopMessagePoller = new WhopMessagePoller();
