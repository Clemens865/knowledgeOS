"""
Knowledge Graph Manager for entity-based knowledge management
"""
import json
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import spacy
from sentence_transformers import SentenceTransformer
import numpy as np

from ..models.entities import (
    Entity, EntityType, Relationship, RelationType, 
    ConfidenceLevel, KnowledgeContext
)


class KnowledgeGraphManager:
    """Manages the knowledge graph with entity recognition and relationships"""
    
    def __init__(self):
        # Entity storage (in production, this would be a database)
        self.entities: Dict[str, Entity] = {}
        self.relationships: List[Relationship] = []
        
        # Load NLP models
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            # If model not installed, we'll handle it gracefully
            self.nlp = None
            
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Canonical file mappings
        self.canonical_mappings = {
            EntityType.PERSON: {
                "work": "Professional Journey.md",
                "personal": "Personal Info.md",
                "projects": "Projects.md"
            },
            EntityType.ORGANIZATION: {
                "default": "Professional Journey.md"
            },
            EntityType.PROJECT: {
                "default": "Projects.md"
            }
        }
    
    async def process_information(self, text: str, source: str = "user") -> Dict[str, Any]:
        """Process new information and update knowledge graph"""
        # Extract entities
        entities = await self.extract_entities(text)
        
        # Extract relationships
        relationships = await self.extract_relationships(text, entities)
        
        # Merge with existing knowledge
        merged_entities = []
        for entity in entities:
            merged = await self.merge_entity(entity, source)
            merged_entities.append(merged)
        
        # Store relationships
        for rel in relationships:
            await self.add_relationship(rel)
        
        # Determine canonical locations
        file_mappings = await self.determine_canonical_locations(merged_entities)
        
        return {
            "entities": [e.dict() for e in merged_entities],
            "relationships": [r.dict() for r in relationships],
            "file_mappings": file_mappings,
            "summary": f"Processed {len(entities)} entities and {len(relationships)} relationships"
        }
    
    async def extract_entities(self, text: str) -> List[Entity]:
        """Extract entities from text using NLP"""
        entities = []
        
        if self.nlp:
            doc = self.nlp(text)
            
            for ent in doc.ents:
                entity_type = self._map_spacy_to_entity_type(ent.label_)
                if entity_type:
                    entity = Entity(
                        id=f"{entity_type.value}_{ent.text.lower().replace(' ', '_')}",
                        type=entity_type,
                        name=ent.text,
                        sources=[text[:100]]  # Store snippet as source
                    )
                    
                    # Generate embeddings
                    entity.embeddings = self.embedder.encode(ent.text).tolist()
                    
                    entities.append(entity)
        
        return entities
    
    def _map_spacy_to_entity_type(self, label: str) -> Optional[EntityType]:
        """Map spaCy NER labels to our entity types"""
        mapping = {
            "PERSON": EntityType.PERSON,
            "ORG": EntityType.ORGANIZATION,
            "GPE": EntityType.LOCATION,
            "LOC": EntityType.LOCATION,
            "EVENT": EntityType.EVENT,
            "WORK_OF_ART": EntityType.PROJECT,
            "PRODUCT": EntityType.PROJECT
        }
        return mapping.get(label)
    
    async def extract_relationships(self, text: str, entities: List[Entity]) -> List[Relationship]:
        """Extract relationships between entities"""
        relationships = []
        
        # Simple pattern matching for relationships
        patterns = {
            "works at": RelationType.WORKS_AT,
            "employed by": RelationType.WORKS_AT,
            "manages": RelationType.MANAGES,
            "reports to": RelationType.REPORTS_TO,
            "located in": RelationType.LOCATED_IN,
            "brother": RelationType.RELATED_TO,
            "sister": RelationType.RELATED_TO,
            "parent": RelationType.RELATED_TO,
            "friend": RelationType.KNOWS
        }
        
        text_lower = text.lower()
        
        for pattern, rel_type in patterns.items():
            if pattern in text_lower:
                # Try to find entity pairs around the pattern
                for i, e1 in enumerate(entities):
                    for e2 in entities[i+1:]:
                        # Check if entities are near the pattern in text
                        if e1.name in text and e2.name in text:
                            rel = Relationship(
                                id=f"rel_{e1.id}_{e2.id}_{rel_type.value}",
                                type=rel_type,
                                source_entity_id=e1.id,
                                target_entity_id=e2.id,
                                source=text[:100]
                            )
                            relationships.append(rel)
        
        return relationships
    
    async def merge_entity(self, new_entity: Entity, source: str) -> Entity:
        """Merge new entity with existing one or create new"""
        existing = self.entities.get(new_entity.id)
        
        if not existing:
            # New entity
            self.entities[new_entity.id] = new_entity
            return new_entity
        
        # Merge attributes
        for key, attributes in new_entity.attributes.items():
            for attr in attributes:
                existing.add_attribute(key, attr.value, source, attr.confidence)
        
        # Update aliases if new ones found
        for alias in new_entity.aliases:
            if alias not in existing.aliases:
                existing.aliases.append(alias)
        
        # Update embeddings (average them)
        if new_entity.embeddings and existing.embeddings:
            existing.embeddings = (
                (np.array(existing.embeddings) + np.array(new_entity.embeddings)) / 2
            ).tolist()
        
        existing.updated_at = datetime.utcnow()
        return existing
    
    async def add_relationship(self, relationship: Relationship):
        """Add a relationship to the graph"""
        # Check for duplicates
        existing = next(
            (r for r in self.relationships 
             if r.source_entity_id == relationship.source_entity_id
             and r.target_entity_id == relationship.target_entity_id
             and r.type == relationship.type),
            None
        )
        
        if not existing:
            self.relationships.append(relationship)
        else:
            # Update confidence if higher
            if relationship.confidence.value > existing.confidence.value:
                existing.confidence = relationship.confidence
            existing.updated_at = datetime.utcnow()
    
    async def determine_canonical_locations(self, entities: List[Entity]) -> Dict[str, str]:
        """Determine where each entity's information should be stored"""
        file_mappings = {}
        
        for entity in entities:
            if entity.type in self.canonical_mappings:
                mappings = self.canonical_mappings[entity.type]
                
                # Determine context from attributes
                if entity.type == EntityType.PERSON:
                    # Check if it's work-related
                    work_attrs = ["job", "position", "company", "work"]
                    personal_attrs = ["family", "hobby", "personal"]
                    
                    has_work = any(
                        key in entity.attributes 
                        for key in work_attrs
                    )
                    has_personal = any(
                        key in entity.attributes 
                        for key in personal_attrs
                    )
                    
                    if has_work:
                        file_mappings[entity.id] = mappings["work"]
                    elif has_personal:
                        file_mappings[entity.id] = mappings["personal"]
                    else:
                        file_mappings[entity.id] = mappings["personal"]  # Default
                else:
                    file_mappings[entity.id] = mappings.get("default", "Knowledge Base.md")
        
        return file_mappings
    
    async def query_knowledge(self, context: KnowledgeContext) -> Dict[str, Any]:
        """Query the knowledge graph based on context"""
        results = {
            "entities": [],
            "relationships": [],
            "suggested_files": []
        }
        
        # Generate query embedding
        query_embedding = self.embedder.encode(context.query)
        
        # Find relevant entities by similarity
        entity_scores = []
        for entity_id, entity in self.entities.items():
            if entity.embeddings:
                similarity = np.dot(query_embedding, entity.embeddings) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(entity.embeddings)
                )
                entity_scores.append((entity, similarity))
        
        # Sort by similarity and filter by threshold
        entity_scores.sort(key=lambda x: x[1], reverse=True)
        relevant_entities = [
            e for e, score in entity_scores[:context.max_results]
            if score > 0.3  # Similarity threshold
        ]
        
        results["entities"] = [e.dict() for e in relevant_entities]
        
        # Get relationships for relevant entities
        if context.include_related:
            entity_ids = {e.id for e in relevant_entities}
            relevant_relationships = [
                r for r in self.relationships
                if r.source_entity_id in entity_ids or r.target_entity_id in entity_ids
            ]
            results["relationships"] = [r.dict() for r in relevant_relationships]
        
        # Suggest files to search
        file_mappings = await self.determine_canonical_locations(relevant_entities)
        results["suggested_files"] = list(set(file_mappings.values()))
        
        return results
    
    async def resolve_conflicts(self, entity_id: str) -> Entity:
        """Resolve conflicts in entity attributes"""
        entity = self.entities.get(entity_id)
        if not entity:
            return None
        
        # For each attribute, keep the best value
        resolved_attributes = {}
        for key, attributes in entity.attributes.items():
            best = max(attributes, key=lambda x: (x.confidence.value, x.timestamp))
            resolved_attributes[key] = [best]
        
        entity.attributes = resolved_attributes
        return entity