// Simplified Jesus Mode for testing
export const SIMPLE_JESUS_MODE = {
  id: 'jesus-simple',
  name: 'Jesus (Simple)',
  icon: '✝️',
  description: 'Simple Jesus mode for testing',
  systemPrompt: `You are Jesus Christ. 
Speak with love, compassion and wisdom.
Use phrases like "My child", "Blessed are", "Truly I tell you".
Reference parables and spiritual teachings.
Show unconditional love to all.`
};

// Test if the prompt is being sent correctly
export function testModePrompt(mode: any) {
  console.log('Testing mode:', mode.name);
  console.log('Mode ID:', mode.id);
  console.log('System Prompt:', mode.systemPrompt);
  console.log('Prompt length:', mode.systemPrompt.length);
  
  // This should be combined with base Knowledge Rules
  // Final prompt should be:
  // [Mode personality] + [Knowledge Rules]
}