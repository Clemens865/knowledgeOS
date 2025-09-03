"""
Universal Agentic Knowledge Management System
Using Python + Pydantic for type safety and validation
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any, Union
from enum import Enum
from datetime import datetime
import asyncio
import hashlib
from abc import ABC, abstractmethod
import networkx as nx
import numpy as np
from sentence_transformers import SentenceTransformer

# Type definitions with Pydantic validation
class EntityType(str, Enum):
    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    CONCEPT = "concept"
    EVENT = "event"
    OBJECT = "object"

class RelationshipType(str, Enum):
    WORKS_AT = "works_at"
    LIVES_IN = "lives_in"
    PARENT_OF = "parent_of"
    SIBLING_OF = "sibling_of"
    MARRIED_TO = "married_to"
    OWNS = "owns"
    KNOWS = "knows"
    PART_OF = "part_of"

class InformationStatus(str, Enum):
    CURRENT = "current"
    HISTORICAL = "historical"
    PLANNED = "planned"
    UNCERTAIN = "uncertain"

class Confidence(BaseModel):
    """Confidence scoring for information"""
    value: float = Field(ge=0.0, le=1.0)
    source: str
    timestamp: datetime
    
    @validator('value')
    def validate_confidence(cls, v):
        if not 0 <= v <= 1:
            raise ValueError('Confidence must be between 0 and 1')
        return v

class Entity(BaseModel):
    """Universal entity representation"""
    id: str
    type: EntityType
    canonical_name: str
    aliases: List[str] = []
    properties: Dict[str, Any] = {}
    embeddings: Optional[List[float]] = None
    confidence: Confidence
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def merge_with(self, other: 'Entity') -> 'Entity':
        """Intelligently merge two entities"""
        # Keep highest confidence values
        for key, value in other.properties.items():
            if key not in self.properties:
                self.properties[key] = value
            elif other.confidence.value > self.confidence.value:
                self.properties[key] = value
        
        # Merge aliases
        self.aliases = list(set(self.aliases + other.aliases))
        self.updated_at = datetime.now()
        return self

class Relationship(BaseModel):
    """Relationship between entities"""
    id: str
    type: RelationshipType
    source_entity_id: str
    target_entity_id: str
    properties: Dict[str, Any] = {}
    confidence: Confidence
    status: InformationStatus = InformationStatus.CURRENT
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None

class KnowledgeNode(BaseModel):
    """Node in the knowledge graph"""
    entity: Entity
    relationships: List[Relationship] = []
    context: Dict[str, Any] = {}
    
    def to_graph_format(self) -> Dict:
        """Convert to graph database format"""
        return {
            'id': self.entity.id,
            'labels': [self.entity.type.value],
            'properties': {
                **self.entity.properties,
                'canonical_name': self.entity.canonical_name,
                'confidence': self.entity.confidence.value
            }
        }

# Agent Base Classes
class KnowledgeAgent(ABC):
    """Base class for all knowledge agents"""
    
    def __init__(self, agent_id: str, capabilities: List[str]):
        self.agent_id = agent_id
        self.capabilities = capabilities
        self.memory: Dict[str, Any] = {}
        self.success_patterns: List[Dict] = []
    
    @abstractmethod
    async def process(self, input_data: Any) -> Any:
        """Process input and return result"""
        pass
    
    def learn_from_outcome(self, action: Dict, success: bool):
        """Learn from successful/failed actions"""
        if success:
            self.success_patterns.append(action)
    
    def get_confidence_for_action(self, action: str) -> float:
        """Calculate confidence based on past success"""
        successes = [p for p in self.success_patterns if p.get('action') == action]
        if not successes:
            return 0.5
        return len(successes) / len(self.success_patterns)

# Specialized Agents
class EntityRecognitionAgent(KnowledgeAgent):
    """Recognizes and extracts entities from text"""
    
    def __init__(self):
        super().__init__("entity_recognizer", ["ner", "entity_linking"])
        # In production, use spaCy or similar
        self.patterns = {
            EntityType.PERSON: [
                r"(?:my |My )?(brother|sister|mother|father|wife|daughter|son) ([A-Z][a-z]+)",
                r"([A-Z][a-z]+ [A-Z][a-z]+) (?:works?|is|was)"
            ],
            EntityType.ORGANIZATION: [
                r"(?:works? at|employed by|company) ([A-Z][a-zA-Z& ]+)",
                r"([A-Z][a-zA-Z& ]+) (?:Inc|Corp|LLC|Ltd|GmbH)"
            ]
        }
    
    async def process(self, text: str) -> List[Entity]:
        """Extract entities from text"""
        entities = []
        
        # Simplified pattern matching (use spaCy in production)
        for entity_type, patterns in self.patterns.items():
            for pattern in patterns:
                # Extract matches and create entities
                # This is simplified - use proper NER
                pass
        
        # Add embeddings for semantic search
        if entities:
            embedder = SentenceTransformer('all-MiniLM-L6-v2')
            for entity in entities:
                entity.embeddings = embedder.encode(entity.canonical_name).tolist()
        
        return entities

class CanonicalLocationAgent(KnowledgeAgent):
    """Determines canonical storage location for information"""
    
    def __init__(self):
        super().__init__("location_router", ["routing", "organization"])
        self.routing_rules = {
            InformationStatus.CURRENT: {
                EntityType.PERSON: lambda e: f"entities/person/{e.id}/current.json",
                EntityType.ORGANIZATION: lambda e: f"entities/org/{e.id}/current.json",
            },
            InformationStatus.HISTORICAL: {
                EntityType.PERSON: lambda e: f"entities/person/{e.id}/history.json",
                EntityType.ORGANIZATION: lambda e: f"entities/org/{e.id}/history.json",
            }
        }
    
    async def process(self, entity: Entity, status: InformationStatus) -> str:
        """Determine canonical location for entity"""
        rule = self.routing_rules.get(status, {}).get(entity.type)
        if rule:
            return rule(entity)
        return f"entities/generic/{entity.id}/data.json"

class ConflictResolutionAgent(KnowledgeAgent):
    """Resolves conflicts in information"""
    
    def __init__(self):
        super().__init__("conflict_resolver", ["merging", "validation"])
        self.strategies = {
            "temporal": self.resolve_by_time,
            "confidence": self.resolve_by_confidence,
            "detail": self.resolve_by_detail,
            "source": self.resolve_by_source
        }
    
    async def process(self, existing: Entity, incoming: Entity) -> Entity:
        """Resolve conflicts between entities"""
        # Detect conflict type
        if existing.updated_at < incoming.updated_at:
            return await self.resolve_by_time(existing, incoming)
        elif incoming.confidence.value > existing.confidence.value:
            return await self.resolve_by_confidence(existing, incoming)
        else:
            return existing.merge_with(incoming)
    
    async def resolve_by_time(self, old: Entity, new: Entity) -> Entity:
        """Latest information wins"""
        return new
    
    async def resolve_by_confidence(self, low: Entity, high: Entity) -> Entity:
        """Higher confidence wins"""
        return high
    
    async def resolve_by_detail(self, sparse: Entity, detailed: Entity) -> Entity:
        """More detailed information wins"""
        if len(detailed.properties) > len(sparse.properties):
            return detailed.merge_with(sparse)
        return sparse.merge_with(detailed)
    
    async def resolve_by_source(self, a: Entity, b: Entity) -> Entity:
        """Trust certain sources more"""
        trusted_sources = ["user_input", "verified_api", "official_document"]
        if a.confidence.source in trusted_sources:
            return a
        return b

class SemanticClusteringAgent(KnowledgeAgent):
    """Groups related information semantically"""
    
    def __init__(self, similarity_threshold: float = 0.7):
        super().__init__("semantic_clusterer", ["clustering", "similarity"])
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.similarity_threshold = similarity_threshold
        self.clusters: Dict[str, List[Entity]] = {}
    
    async def process(self, entity: Entity) -> str:
        """Assign entity to semantic cluster"""
        if not entity.embeddings:
            entity.embeddings = self.embedder.encode(entity.canonical_name).tolist()
        
        # Find most similar cluster
        best_cluster = None
        best_similarity = 0
        
        for cluster_id, cluster_entities in self.clusters.items():
            # Calculate average similarity to cluster
            similarities = []
            for cluster_entity in cluster_entities[:5]:  # Sample for efficiency
                if cluster_entity.embeddings:
                    sim = self.cosine_similarity(
                        entity.embeddings, 
                        cluster_entity.embeddings
                    )
                    similarities.append(sim)
            
            if similarities:
                avg_sim = np.mean(similarities)
                if avg_sim > best_similarity:
                    best_similarity = avg_sim
                    best_cluster = cluster_id
        
        if best_similarity > self.similarity_threshold:
            self.clusters[best_cluster].append(entity)
            return best_cluster
        else:
            # Create new cluster
            new_cluster_id = hashlib.md5(entity.canonical_name.encode()).hexdigest()
            self.clusters[new_cluster_id] = [entity]
            return new_cluster_id
    
    def cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between embeddings"""
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Knowledge Graph Manager
class KnowledgeGraphManager:
    """Manages the entire knowledge graph with agents"""
    
    def __init__(self):
        self.graph = nx.DiGraph()
        self.agents = {
            'entity_recognizer': EntityRecognitionAgent(),
            'location_router': CanonicalLocationAgent(),
            'conflict_resolver': ConflictResolutionAgent(),
            'semantic_clusterer': SemanticClusteringAgent()
        }
        self.entity_store: Dict[str, Entity] = {}
    
    async def process_information(self, text: str, source: str = "user") -> Dict[str, Any]:
        """Process any information through agent pipeline"""
        
        # 1. Extract entities
        entities = await self.agents['entity_recognizer'].process(text)
        
        # 2. For each entity, check if it exists
        results = []
        for entity in entities:
            entity.confidence = Confidence(
                value=0.9,
                source=source,
                timestamp=datetime.now()
            )
            
            # Check for existing entity
            existing = self.entity_store.get(entity.id)
            
            if existing:
                # Resolve conflicts
                resolved = await self.agents['conflict_resolver'].process(
                    existing, entity
                )
                self.entity_store[entity.id] = resolved
                action = "updated"
            else:
                self.entity_store[entity.id] = entity
                action = "created"
            
            # Determine storage location
            location = await self.agents['location_router'].process(
                entity, InformationStatus.CURRENT
            )
            
            # Cluster semantically
            cluster = await self.agents['semantic_clusterer'].process(entity)
            
            # Update graph
            self.graph.add_node(
                entity.id,
                **entity.dict()
            )
            
            results.append({
                "entity": entity.canonical_name,
                "action": action,
                "location": location,
                "cluster": cluster,
                "confidence": entity.confidence.value
            })
        
        return {
            "processed": text,
            "entities": results,
            "graph_size": self.graph.number_of_nodes()
        }
    
    async def query(self, question: str) -> Dict[str, Any]:
        """Query the knowledge graph"""
        # Extract entities from question
        query_entities = await self.agents['entity_recognizer'].process(question)
        
        results = []
        for entity in query_entities:
            # Find in graph
            if entity.id in self.entity_store:
                stored_entity = self.entity_store[entity.id]
                
                # Get related entities
                if entity.id in self.graph:
                    neighbors = list(self.graph.neighbors(entity.id))
                    related = [self.entity_store.get(n) for n in neighbors if n in self.entity_store]
                else:
                    related = []
                
                results.append({
                    "entity": stored_entity.dict(),
                    "related": [r.dict() for r in related if r]
                })
        
        return {
            "query": question,
            "results": results
        }

# Example usage
async def main():
    # Initialize the knowledge system
    knowledge = KnowledgeGraphManager()
    
    # Process various types of information
    examples = [
        "My brother Julian works at Apple as a designer",
        "I currently work at Yorizon as Marketing Manager",
        "Julian was born on September 11, 1976",
        "My daughter Clara has celiac disease",
        "I worked at cmotion for 10 years before Yorizon"
    ]
    
    for text in examples:
        result = await knowledge.process_information(text)
        print(f"Processed: {text[:50]}...")
        print(f"Entities found: {len(result['entities'])}")
        print(f"Graph size: {result['graph_size']}")
        print()
    
    # Query the knowledge
    queries = [
        "Where do I work?",
        "Tell me about Julian",
        "What health conditions are in my family?"
    ]
    
    for query in queries:
        result = await knowledge.query(query)
        print(f"Query: {query}")
        print(f"Results: {len(result['results'])} entities found")
        print()

if __name__ == "__main__":
    asyncio.run(main())