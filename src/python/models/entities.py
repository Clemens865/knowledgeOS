"""
Entity models for the Knowledge Management System
"""
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class EntityType(str, Enum):
    """Types of entities in the knowledge system"""
    PERSON = "person"
    ORGANIZATION = "organization"
    PROJECT = "project"
    SKILL = "skill"
    LOCATION = "location"
    EVENT = "event"
    CONCEPT = "concept"
    DOCUMENT = "document"
    TASK = "task"
    GOAL = "goal"


class RelationType(str, Enum):
    """Types of relationships between entities"""
    WORKS_AT = "works_at"
    KNOWS = "knows"
    LOCATED_IN = "located_in"
    PART_OF = "part_of"
    RELATED_TO = "related_to"
    CREATED_BY = "created_by"
    MANAGES = "manages"
    REPORTS_TO = "reports_to"
    COLLABORATES_WITH = "collaborates_with"
    DEPENDS_ON = "depends_on"


class ConfidenceLevel(str, Enum):
    """Confidence levels for information"""
    VERIFIED = "verified"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"


class Attribute(BaseModel):
    """Represents an attribute of an entity"""
    key: str
    value: Any
    confidence: ConfidenceLevel = ConfidenceLevel.HIGH
    source: str = "user"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: int = 1
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Entity(BaseModel):
    """Core entity model"""
    id: str
    type: EntityType
    name: str
    aliases: List[str] = []
    attributes: Dict[str, List[Attribute]] = {}
    embeddings: Optional[List[float]] = None
    canonical_file: Optional[str] = None
    confidence: ConfidenceLevel = ConfidenceLevel.HIGH
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    sources: List[str] = []
    
    @validator('updated_at', pre=True, always=True)
    def set_updated_at(cls, v):
        return datetime.utcnow()
    
    def add_attribute(self, key: str, value: Any, source: str = "user", 
                     confidence: ConfidenceLevel = ConfidenceLevel.HIGH):
        """Add or update an attribute"""
        if key not in self.attributes:
            self.attributes[key] = []
        
        # Check if we already have this value
        existing = next((attr for attr in self.attributes[key] 
                        if attr.value == value), None)
        
        if existing:
            # Update confidence if higher
            if confidence.value > existing.confidence.value:
                existing.confidence = confidence
            existing.timestamp = datetime.utcnow()
        else:
            self.attributes[key].append(
                Attribute(key=key, value=value, source=source, 
                         confidence=confidence)
            )
    
    def get_latest_attribute(self, key: str) -> Optional[Attribute]:
        """Get the most recent value for an attribute"""
        if key not in self.attributes or not self.attributes[key]:
            return None
        return max(self.attributes[key], key=lambda x: x.timestamp)
    
    def get_best_attribute(self, key: str) -> Optional[Attribute]:
        """Get the value with highest confidence for an attribute"""
        if key not in self.attributes or not self.attributes[key]:
            return None
        return max(self.attributes[key], 
                  key=lambda x: (x.confidence.value, x.timestamp))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Relationship(BaseModel):
    """Represents a relationship between entities"""
    id: str
    type: RelationType
    source_entity_id: str
    target_entity_id: str
    attributes: Dict[str, Any] = {}
    confidence: ConfidenceLevel = ConfidenceLevel.HIGH
    temporal_context: Optional[str] = None  # e.g., "2020-2023"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    source: str = "user"
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class KnowledgeContext(BaseModel):
    """Context for knowledge operations"""
    query: str
    intent: str  # e.g., "current_status", "historical", "relationship"
    entities_mentioned: List[str] = []
    time_context: Optional[str] = None
    confidence_threshold: ConfidenceLevel = ConfidenceLevel.MEDIUM
    max_results: int = 10
    include_related: bool = True