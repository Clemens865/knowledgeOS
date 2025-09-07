/**
 * Test suite for SearchMemory service
 * This is a demonstration of how the memory system works
 */
import SearchMemory from './SearchMemory';

export class SearchMemoryTest {
  private memory: SearchMemory;

  constructor() {
    this.memory = new SearchMemory();
  }

  /**
   * Run comprehensive tests of the SearchMemory system
   */
  async runTests(): Promise<void> {
    console.log('🧪 Starting SearchMemory Tests...\n');

    try {
      await this.testBasicRecording();
      await this.testSearchSuggestions();
      await this.testMemoryContext();
      await this.testPatternLearning();
      await this.testCleanup();
      
      console.log('✅ All SearchMemory tests passed!');
    } catch (error) {
      console.error('❌ SearchMemory test failed:', error);
    } finally {
      this.memory.close();
    }
  }

  /**
   * Test basic search pattern recording
   */
  private async testBasicRecording(): Promise<void> {
    console.log('📊 Testing basic search pattern recording...');
    
    // Record some sample search patterns
    await this.memory.recordSearch('birthday', ['Personal Info.md'], true);
    await this.memory.recordSearch('work meeting', ['Work Notes.md', 'Projects.md'], true);
    await this.memory.recordSearch('contact info', ['Contacts.md'], true);
    await this.memory.recordSearch('vacation plans', [], false); // No results
    await this.memory.recordSearch('birthday', ['Personal Info.md'], true); // Duplicate to test counting
    
    console.log('✓ Search patterns recorded successfully\n');
  }

  /**
   * Test search suggestions based on historical patterns
   */
  private async testSearchSuggestions(): Promise<void> {
    console.log('🔍 Testing search suggestions...');
    
    const suggestions = await this.memory.getSearchSuggestions('birth', 5);
    console.log('Suggestions for "birth":', suggestions);
    
    const workSuggestions = await this.memory.getSearchSuggestions('work', 3);
    console.log('Suggestions for "work":', workSuggestions);
    
    console.log('✓ Search suggestions generated successfully\n');
  }

  /**
   * Test memory context generation for LLM prompts
   */
  private async testMemoryContext(): Promise<void> {
    console.log('📝 Testing memory context generation...');
    
    const context = await this.memory.getMemoryContext();
    console.log('Generated memory context:');
    console.log(context);
    
    console.log('✓ Memory context generated successfully\n');
  }

  /**
   * Test pattern learning and organization insights
   */
  private async testPatternLearning(): Promise<void> {
    console.log('🎯 Testing pattern learning...');
    
    // Add more diverse patterns
    await this.memory.recordSearch('project status', ['Projects.md'], true);
    await this.memory.recordSearch('meeting notes', ['Work Notes.md'], true);
    await this.memory.recordSearch('family events', ['Personal Info.md'], true);
    
    const patterns = await this.memory.getFrequentPatterns(10);
    console.log('Frequent patterns learned:', patterns);
    
    const orgPatterns = await this.memory.getFileOrganizationPatterns();
    console.log('Organization patterns:', orgPatterns);
    
    console.log('✓ Pattern learning working correctly\n');
  }

  /**
   * Test cleanup functionality
   */
  private async testCleanup(): Promise<void> {
    console.log('🧹 Testing cleanup functionality...');
    
    // This would normally clean old patterns, but since we just created them,
    // it won't remove anything. This tests that the cleanup runs without errors.
    await this.memory.cleanupOldPatterns();
    
    console.log('✓ Cleanup completed without errors\n');
  }
}

/**
 * Sample usage demonstration
 */
export async function demonstrateSearchMemory(): Promise<void> {
  console.log('🚀 SearchMemory Demonstration\n');
  console.log('This demonstrates how the Windsurf-style memory system works:');
  console.log('1. Records search patterns and success rates');
  console.log('2. Learns file organization patterns');  
  console.log('3. Provides intelligent search suggestions');
  console.log('4. Maintains cross-session persistence');
  console.log('5. Generates memory context for LLM prompts\n');
  
  const test = new SearchMemoryTest();
  await test.runTests();
}

// Export for potential use in main application
export { SearchMemory };

// Example of how to integrate into the main app:
export const SEARCH_MEMORY_INTEGRATION_EXAMPLE = `
// In your main application initialization:
import SearchMemory from './services/SearchMemory';

let searchMemory: SearchMemory;

// Initialize
searchMemory = new SearchMemory();

// Record search results after each search operation
await searchMemory.recordSearch(query, foundFiles, wasSuccessful);

// Get suggestions for new searches
const suggestions = await searchMemory.getSearchSuggestions(userQuery, 5);

// Include memory context in LLM prompts
const memoryContext = await searchMemory.getMemoryContext();
const enhancedPrompt = basePrompt + '\\n\\n' + memoryContext;

// Cleanup on app shutdown
searchMemory.close();
`;

/**
 * Expected memory context format that will be included in LLM prompts:
 * 
 * <search_memory>
 *   <frequent_patterns>
 *     <pattern query="birthday" files="Personal Info.md" success_rate="100%"/>
 *     <pattern query="work" files="Work Notes.md, Projects.md" success_rate="85%"/>
 *   </frequent_patterns>
 *   <suggested_locations>
 *     Based on your organization:
 *     Personal info → Personal Info.md
 *     Work info → Work Notes.md, Projects.md
 *   </suggested_locations>
 * </search_memory>
 */