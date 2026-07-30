import AIConversation from '../models/AIConversation.js';

class AIService {
  constructor() {
    // In production, initialize OpenAI or Gemini here
    // this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateResponse(message, context = {}) {
    try {
      // Mock AI response for now
      // Replace with actual AI API call
      const responses = {
        'hello': 'Hello! How can I help you with the weather today?',
        'weather': `Today's weather is ${context.weather?.temperature || 'unknown'}°C with ${context.weather?.condition?.description || 'clear skies'}.`,
        'outfit': 'Based on the weather, I recommend wearing light and comfortable clothing.',
        'default': 'I understand your asking about the weather. Let me help you with that.'
      };

      let response = responses.default;
      const lowerMsg = message.toLowerCase();
      
      if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        response = responses.hello;
      } else if (lowerMsg.includes('weather') || lowerMsg.includes('temperature')) {
        response = responses.weather;
      } else if (lowerMsg.includes('wear') || lowerMsg.includes('outfit') || lowerMsg.includes('clothes')) {
        response = responses.outfit;
      }

      return response;
    } catch (error) {
      console.error('AI Service error:', error);
      return 'I apologize, but I\'m having trouble processing your request right now.';
    }
  }

  async getDailySummary(weatherData) {
    if (!weatherData) {
      return {
        message: '☀️ Good morning! Today is a beautiful day.',
        recommendations: ['Enjoy the outdoors!', 'Stay hydrated.']
      };
    }

    const temp = weatherData.temperature;
    const condition = weatherData.condition?.main || 'clear';
    const feelsLike = weatherData.feelsLike;

    let message = '';
    let recommendations = [];

    if (temp > 25) {
      message = `☀️ It's a warm day with ${temp}°C. Perfect for outdoor activities!`;
      recommendations = ['🏊 Go for a swim', '🧴 Apply sunscreen', '💧 Stay hydrated'];
    } else if (temp > 15) {
      message = `🌤️ Pleasant weather with ${temp}°C. Great day to be outside!`;
      recommendations = ['🚶 Go for a walk', '☕ Enjoy coffee outdoors', '📚 Read in the park'];
    } else if (temp > 5) {
      message = `🌥️ Cool day with ${temp}°C. Layer up for comfort.`;
      recommendations = ['🧥 Wear a light jacket', '🏠 Indoor activities', '☕ Warm drinks'];
    } else {
      message = `❄️ Cold day with ${temp}°C. Stay warm!`;
      recommendations = ['🧣 Bundle up', '🏠 Stay indoors', '☕ Hot drinks'];
    }

    if (condition.toLowerCase().includes('rain')) {
      message += ' 🌧️ Remember to carry an umbrella!';
      recommendations.push('☂️ Bring umbrella');
    }

    return {
      message,
      recommendations,
      weather: weatherData,
    };
  }

  async getOutfitRecommendation(weatherData, occasion = 'casual') {
    const temp = weatherData?.temperature || 20;
    const condition = weatherData?.condition?.main?.toLowerCase() || 'clear';

    const outfit = {
      casual: {
        warm: [
          { type: 'top', name: 'T-shirt', reason: 'Comfortable for warm weather' },
          { type: 'bottom', name: 'Shorts', reason: 'Keeps you cool' },
          { type: 'shoes', name: 'Sandals', reason: 'Breathable' },
        ],
        cool: [
          { type: 'top', name: 'Long Sleeve', reason: 'Provides warmth' },
          { type: 'bottom', name: 'Jeans', reason: 'Comfortable and warm' },
          { type: 'shoes', name: 'Sneakers', reason: 'Comfortable' },
        ],
        cold: [
          { type: 'top', name: 'Sweater', reason: 'Keeps you warm' },
          { type: 'bottom', name: 'Warm Pants', reason: 'Insulated' },
          { type: 'shoes', name: 'Boots', reason: 'Warm and sturdy' },
        ],
      },
      formal: {
        warm: [
          { type: 'top', name: 'Dress Shirt', reason: 'Professional look' },
          { type: 'bottom', name: 'Dress Pants', reason: 'Formal attire' },
          { type: 'shoes', name: 'Oxford Shoes', reason: 'Classic formal' },
        ],
        cool: [
          { type: 'top', name: 'Dress Shirt with Vest', reason: 'Layered formal' },
          { type: 'bottom', name: 'Dress Pants', reason: 'Formal attire' },
          { type: 'shoes', name: 'Oxford Shoes', reason: 'Classic formal' },
        ],
        cold: [
          { type: 'top', name: 'Dress Shirt with Blazer', reason: 'Warm and formal' },
          { type: 'bottom', name: 'Dress Pants', reason: 'Formal attire' },
          { type: 'shoes', name: 'Oxford Shoes', reason: 'Classic formal' },
        ],
      },
    };

    let tempCategory = 'warm';
    if (temp < 10) tempCategory = 'cold';
    else if (temp < 20) tempCategory = 'cool';

    const recommendations = outfit[occasion]?.[tempCategory] || outfit.casual.warm;

    // Add rain protection if needed
    if (condition.includes('rain')) {
      recommendations.push({ type: 'accessory', name: 'Raincoat/Umbrella', reason: 'Stay dry' });
    }

    return {
      recommended: recommendations,
      alternative: recommendations.slice(0, 2).map(item => ({
        ...item,
        name: `Alternative ${item.name}`,
        reason: 'Another option'
      })),
      weatherImpact: `${temp}°C with ${condition}`,
      occasion: occasion,
    };
  }

  async getMoodForecast(weatherData) {
    const temp = weatherData?.temperature || 20;
    const condition = weatherData?.condition?.main?.toLowerCase() || 'clear';
    const humidity = weatherData?.humidity || 50;

    let mood = 'happy';
    let score = 75;
    let energyLevel = 70;

    if (temp > 30) {
      mood = 'tired';
      score = 60;
      energyLevel = 50;
    } else if (temp > 20 && temp <= 30) {
      mood = 'energetic';
      score = 85;
      energyLevel = 85;
    } else if (temp > 10 && temp <= 20) {
      mood = 'calm';
      score = 80;
      energyLevel = 75;
    } else {
      mood = 'melancholic';
      score = 65;
      energyLevel = 55;
    }

    if (condition.includes('rain')) {
      mood = 'cozy';
      score = 70;
      energyLevel = 60;
    }

    if (condition.includes('storm')) {
      mood = 'anxious';
      score = 55;
      energyLevel = 45;
    }

    return {
      mood,
      score,
      energyLevel,
      productivityScore: Math.round((score + energyLevel) / 2),
      recommendations: {
        activities: [
          mood === 'energetic' ? '🏃 Outdoor exercise' : '🧘 Indoor relaxation',
          '📚 Read a book',
          '🎵 Listen to music'
        ],
        music: ['🎵 Upbeat pop', '🎶 Chill vibes'],
        meditation: 'Take 10 minutes to focus on your breathing',
      },
    };
  }

  async getImpactScore(weatherData) {
    const temp = weatherData?.temperature || 20;
    const condition = weatherData?.condition?.main?.toLowerCase() || 'clear';
    const windSpeed = weatherData?.windSpeed || 5;

    const baseScore = 70;
    let scores = {
      productivity: 75,
      travel: 70,
      photography: 80,
      sports: 75,
      dating: 70,
      shopping: 75,
      driving: 70,
      kids: 75,
      seniorCitizens: 70,
    };

    // Adjust based on weather
    if (temp > 20 && temp < 30 && !condition.includes('rain')) {
      // Perfect weather - boost all scores
      Object.keys(scores).forEach(key => {
        scores[key] = Math.min(95, scores[key] + 15);
      });
    } else if (temp > 30 || temp < 5) {
      // Extreme weather - lower some scores
      scores.sports = Math.max(40, scores.sports - 20);
      scores.travel = Math.max(50, scores.travel - 15);
      scores.seniorCitizens = Math.max(40, scores.seniorCitizens - 25);
    } else if (condition.includes('rain')) {
      scores.photography = Math.max(40, scores.photography - 30);
      scores.sports = Math.max(50, scores.sports - 15);
      scores.kids = Math.max(55, scores.kids - 20);
    } else if (windSpeed > 20) {
      scores.driving = Math.max(45, scores.driving - 25);
      scores.sports = Math.max(50, scores.sports - 20);
    }

    // Calculate overall score
    const overall = Math.round(
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
    );

    return {
      ...scores,
      overall,
    };
  }

  async saveConversation(userId, type, message, response, context = {}) {
    try {
      const conversation = new AIConversation({
        userId,
        type,
        messages: [
          { role: 'user', content: message },
          { role: 'assistant', content: response },
        ],
        context,
      });
      await conversation.save();
      return conversation;
    } catch (error) {
      console.error('Save conversation error:', error);
      return null;
    }
  }
}

export default new AIService();