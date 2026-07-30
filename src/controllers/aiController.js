const asyncHandler = require('express-async-handler');
const AIConversation = require('../models/AIConversation');
const { generateAIResponse } = require('../services/aiService');

const chat = asyncHandler(async (req, res) => {
  const { conversationId, message, type = 'chat', weatherContext } = req.body;

  let conversation = conversationId
    ? await AIConversation.findOne({ _id: conversationId, user: req.user._id })
    : null;

  if (!conversation) {
    conversation = await AIConversation.create({ user: req.user._id, type, messages: [] });
  }

  conversation.messages.push({ role: 'user', content: message });

  const reply = await generateAIResponse({
    type,
    weatherContext,
    messages: conversation.messages.map(({ role, content }) => ({ role, content })),
  });

  conversation.messages.push({ role: 'assistant', content: reply });
  await conversation.save();

  res.json({ conversationId: conversation._id, reply });
});

const getConversations = asyncHandler(async (req, res) => {
  const conversations = await AIConversation.find({ user: req.user._id }).sort({ updatedAt: -1 });
  res.json({ conversations });
});

module.exports = { chat, getConversations };
