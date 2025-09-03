"""
Simple test script for the Knowledge Management Service
Run this to test entity extraction and knowledge graph functionality
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.knowledge_graph import KnowledgeGraphManager
from models.entities import KnowledgeContext

async def test_knowledge_service():
    """Test the knowledge management service"""
    
    print("🧪 Testing Knowledge Management Service\n")
    
    # Initialize the knowledge manager
    km = KnowledgeGraphManager()
    
    # Test 1: Process text with entity extraction
    print("Test 1: Processing text with entities")
    print("-" * 50)
    
    text1 = """
    My name is Clemens and I work at a tech company in San Francisco.
    My brother Julian works at Apple as a software engineer.
    We both enjoy coding and often collaborate on projects together.
    """
    
    result1 = await km.process_information(text1)
    print(f"Extracted {len(result1['entities'])} entities:")
    for entity in result1['entities']:
        print(f"  - {entity['name']} ({entity['type']})")
    print(f"Found {len(result1['relationships'])} relationships")
    print()
    
    # Test 2: Process duplicate information
    print("Test 2: Processing duplicate information (conflict resolution)")
    print("-" * 50)
    
    text2 = """
    Julian is my brother and he's been working at Apple for 5 years now.
    He specializes in machine learning and iOS development.
    """
    
    result2 = await km.process_information(text2)
    print(f"Processed {len(result2['entities'])} entities (should merge with existing)")
    print(f"File mappings: {result2['file_mappings']}")
    print()
    
    # Test 3: Query the knowledge graph
    print("Test 3: Querying the knowledge graph")
    print("-" * 50)
    
    queries = [
        "Where do I work?",
        "Tell me about Julian",
        "What company does my brother work for?"
    ]
    
    for query in queries:
        print(f"\nQuery: '{query}'")
        context = KnowledgeContext(
            query=query,
            intent="question",
            max_results=5,
            include_related=True
        )
        
        result = await km.query_knowledge(context)
        print(f"  Found {len(result['entities'])} relevant entities")
        if result['suggested_files']:
            print(f"  Suggested files: {', '.join(result['suggested_files'])}")
        
        if result['entities']:
            print("  Top entities:")
            for entity in result['entities'][:3]:
                print(f"    - {entity['name']} ({entity['type']})")
    
    # Test 4: Canonical location determination
    print("\nTest 4: Canonical file locations")
    print("-" * 50)
    
    all_entities = list(km.entities.values())
    file_mappings = await km.determine_canonical_locations(all_entities)
    
    print("Entity to file mappings:")
    for entity_id, file_path in file_mappings.items():
        entity = km.entities.get(entity_id)
        if entity:
            print(f"  {entity.name} -> {file_path}")
    
    # Test 5: Conflict resolution
    print("\nTest 5: Conflict resolution")
    print("-" * 50)
    
    # Add conflicting information
    if all_entities:
        entity = all_entities[0]
        entity.add_attribute("test_attr", "value1", "source1")
        entity.add_attribute("test_attr", "value2", "source2")
        entity.add_attribute("test_attr", "value3", "source3")
        
        print(f"Entity '{entity.name}' has conflicting values for 'test_attr':")
        if "test_attr" in entity.attributes:
            for attr in entity.attributes["test_attr"]:
                print(f"  - {attr.value} (confidence: {attr.confidence}, source: {attr.source})")
        
        # Resolve conflicts
        resolved = await km.resolve_conflicts(entity.id)
        print(f"\nAfter resolution:")
        if resolved and "test_attr" in resolved.attributes:
            for attr in resolved.attributes["test_attr"]:
                print(f"  - {attr.value} (confidence: {attr.confidence})")
    
    print("\n✅ All tests completed!")


if __name__ == "__main__":
    # Check if spaCy model is installed
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        print("✅ spaCy model is installed\n")
    except:
        print("⚠️  spaCy model not installed. Installing now...")
        print("Run: python -m spacy download en_core_web_sm")
        print("Note: Entity extraction will be limited without the model\n")
    
    # Run the tests
    asyncio.run(test_knowledge_service())