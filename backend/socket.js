const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

// Room naming helper (keeps things consistent)
const roomNames = {
  admins: 'admins',
  superadmins: 'superadmins',
  user: (id) => `user:${id}`,
};

// Initialize Socket.IO server with CORS configuration
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });
//usefocuseffect
  // Handle Socket.IO connections
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Authenticate socket connection with JWT
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId || decoded.id || null;
      } catch (err) {
        console.error('Socket authentication failed:', err.message);
        socket.disconnect();
        return;
      }
    } else {
      console.error('No token provided for socket connection');
      socket.disconnect();
      return;
    }

    /**
     * Register socket into appropriate rooms
     * Expected payload: { role: 'user'|'admin'|'superadmin', userId?: string }
     */
    socket.on('register', ({ role, userId }) => {
      try {
        if (role === 'admin') socket.join(roomNames.admins);
        if (role === 'superadmin') socket.join(roomNames.superadmins);

        // Always join the personal user room
        const uid = userId || socket.userId;
        socket.join(roomNames.user(uid));

        console.log(`User ${uid} joined rooms for role: ${role}`);
      } catch (e) {
        console.error('Room join error:', e.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Emit helper functions for server.js
  const emitters = {
    // When a barcode is scanned
    barcodeScanned: (payload) => {
      io.to(roomNames.admins).emit('barcode:scanned', payload);
      io.to(roomNames.superadmins).emit('barcode:scanned', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('points:updated', payload);
      }
      io.emit('metrics:updated'); // global KPI refresh signal
    },

    // When a user profile or points change
    // User updates (profile, status, points, etc.)
    userUpdated: (payload) => {
      io.to(roomNames.admins).emit('user:updated', payload);
      io.to(roomNames.superadmins).emit('user:updated', payload);
      if (payload?.id) {
        io.to(roomNames.user(payload.id)).emit('user:selfUpdated', payload);
      }
      io.emit('metrics:updated');
    },
    userDeleted: (payload) => {
      io.to(roomNames.admins).emit('user:deleted', payload);
      io.to(roomNames.superadmins).emit('user:deleted', payload);
      io.emit('metrics:updated');
    },

    // Barcode events
    barcodeUpdated: (payload) => {
      io.to(roomNames.admins).emit('barcode:updated', payload);
      io.to(roomNames.superadmins).emit('barcode:updated', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('barcode:updated', payload);
      }
      io.emit('metrics:updated');
    },
    barcodeDeleted: (payload) => {
      io.to(roomNames.admins).emit('barcode:deleted', payload);
      io.to(roomNames.superadmins).emit('barcode:deleted', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('barcode:deleted', payload);
      }
      io.emit('metrics:updated');
    },

    // Points targeted update (useful after scan)
    pointsUpdated: (payload) => {
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('points:updated', payload);
      }
      io.emit('metrics:updated');
    },

    // Rewards
    rewardUpdated: (payload) => {
      console.log('🔔 Emitting reward:updated to all clients:', payload);
      io.to(roomNames.admins).emit('reward:updated', payload);
      io.to(roomNames.superadmins).emit('reward:updated', payload);
      // Emit to all users globally so they get immediate updates when admin shares images
      io.emit('reward:updated', payload);
      console.log('✅ reward:updated event broadcasted to all connected clients');
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('reward:updated', payload);
      }
      io.emit('metrics:updated');
    },



    // Inside your emitters object
rewardCreated: (payload) => {
  io.emit('rewardCreated', payload); // <-- BROADCAST TO ALL USERS
  io.to(roomNames.admins).emit('reward:created', payload);
  io.to(roomNames.superadmins).emit('reward:created', payload);
  io.emit('metrics:updated');
},
    // Redemptions
    redemptionUpdated: (payload) => {
      io.to(roomNames.admins).emit('redemption:updated', payload);
      io.to(roomNames.superadmins).emit('redemption:updated', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('redemption:updated', payload);
      }
      io.emit('metrics:updated');
    },

    // Notifications
    notificationUpdated: (payload) => {
      io.to(roomNames.admins).emit('notification:updated', payload);
      io.to(roomNames.superadmins).emit('notification:updated', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('notification:updated', payload);
      }
    },
    // NEW - history updates (timeline events)
    historyUpdated: (payload) => {
      io.to(roomNames.admins).emit('history:updated', payload);
      io.to(roomNames.superadmins).emit('history:updated', payload);
      if (payload?.userId) {
        io.to(roomNames.user(payload.userId)).emit('history:updated', payload);
      }
    },

    // ✅ New emitter for admin registration
    adminNeedsApproval: (payload) => {
      io.to(roomNames.superadmins).emit('admin:needsApproval', payload);
    },

    // NEW - For new user registration (pending approval notification to admin)
    userPendingApproval: (payload) => {
      io.to(roomNames.admins).emit('user:pendingApproval', payload); // ✅ To admins
      io.to(roomNames.superadmins).emit('user:pendingApproval', payload); // ✅ To superadmins if needed
    },
  };
  

  // Return both io and emitters so server.js can use them
  return { io, emitters, roomNames };
};

module.exports = { initializeSocket };
