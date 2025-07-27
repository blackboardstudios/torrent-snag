// Handler Factory for Torrent Snag extension
'use strict';

// Handler Factory
class HandlerFactory {
  static createHandler(handlerType, config) {
    switch (handlerType) {
      case 'qbittorrent':
        return new QBittorrentHandler(config);
      case 'transmission':
        return new TransmissionHandler(config);
      case 'deluge':
        return new DelugeHandler(config);
      case 'download':
        return new GenericDownloadHandler(config);
      default:
        throw new Error(`Unknown handler type: ${handlerType}`);
    }
  }

  static getAvailableHandlers() {
    return [
      {
        id: 'qbittorrent',
        name: 'qBittorrent',
        description: 'Send torrents to qBittorrent Web UI',
        requiresAuth: true,
        fields: ['url', 'username', 'password', 'defaultLabel']
      },
      {
        id: 'transmission',
        name: 'Transmission',
        description: 'Send torrents to Transmission daemon',
        requiresAuth: true,
        fields: ['url', 'username', 'password', 'defaultLabel']
      },
      {
        id: 'deluge',
        name: 'Deluge',
        description: 'Send torrents to Deluge Web UI',
        requiresAuth: true,
        fields: ['url', 'password', 'defaultLabel']
      },
      {
        id: 'download',
        name: 'Generic Download',
        description: 'Download torrent files to default download folder',
        requiresAuth: false,
        fields: []
      }
    ];
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.HandlerFactory = HandlerFactory;
}