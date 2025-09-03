"""
FastAPI server for Knowledge Management System
Provides REST API for TypeScript/Electron frontend
"""
import os
import sys
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.knowledge_graph import KnowledgeGraphManager
from models.entities import KnowledgeContext, ConfidenceLevel

# Initialize FastAPI app
app = FastAPI(
    title="KnowledgeOS Intelligence API",
    description="Entity-based knowledge management with AI",
    version="1.0.0"
)

# Configure CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "file://*"],  # Allow Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize knowledge manager
knowledge_manager = KnowledgeGraphManager()


# Request/Response models
class ProcessTextRequest(BaseModel):
    text: str
    source: str = "user"
    context: Optional[str] = None


class QueryRequest(BaseModel):
    query: str
    intent: Optional[str] = None
    max_results: int = 10
    confidence_threshold: str = "medium"
    include_related: bool = True


class EntityUpdateRequest(BaseModel):
    entity_id: str
    attributes: Dict[str, Any]
    source: str = "user"


class HealthResponse(BaseModel):
    status: str
    version: str
    nlp_available: bool
    entities_count: int
    relationships_count: int


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the service is running and healthy"""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        nlp_available=knowledge_manager.nlp is not None,
        entities_count=len(knowledge_manager.entities),
        relationships_count=len(knowledge_manager.relationships)
    )


@app.post("/process")
async def process_text(request: ProcessTextRequest):
    """Process new text and extract entities/relationships"""
    try:
        result = await knowledge_manager.process_information(
            request.text,
            request.source
        )
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
async def query_knowledge(request: QueryRequest):
    """Query the knowledge graph"""
    try:
        context = KnowledgeContext(
            query=request.query,
            intent=request.intent or "general",
            confidence_threshold=ConfidenceLevel(request.confidence_threshold),
            max_results=request.max_results,
            include_related=request.include_related
        )
        
        result = await knowledge_manager.query_knowledge(context)
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entities")
async def list_entities(entity_type: Optional[str] = None):
    """List all entities, optionally filtered by type"""
    entities = knowledge_manager.entities.values()
    
    if entity_type:
        entities = [e for e in entities if e.type.value == entity_type]
    
    return {
        "success": True,
        "data": {
            "entities": [e.dict() for e in entities],
            "count": len(entities)
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/entities/{entity_id}")
async def get_entity(entity_id: str):
    """Get a specific entity by ID"""
    entity = knowledge_manager.entities.get(entity_id)
    
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")
    
    # Get related relationships
    relationships = [
        r for r in knowledge_manager.relationships
        if r.source_entity_id == entity_id or r.target_entity_id == entity_id
    ]
    
    return {
        "success": True,
        "data": {
            "entity": entity.dict(),
            "relationships": [r.dict() for r in relationships]
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@app.put("/entities/{entity_id}")
async def update_entity(entity_id: str, request: EntityUpdateRequest):
    """Update an entity's attributes"""
    entity = knowledge_manager.entities.get(entity_id)
    
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")
    
    # Add attributes
    for key, value in request.attributes.items():
        entity.add_attribute(key, value, request.source)
    
    # Resolve conflicts if needed
    entity = await knowledge_manager.resolve_conflicts(entity_id)
    
    return {
        "success": True,
        "data": {
            "entity": entity.dict()
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/relationships")
async def list_relationships(entity_id: Optional[str] = None):
    """List all relationships, optionally filtered by entity"""
    relationships = knowledge_manager.relationships
    
    if entity_id:
        relationships = [
            r for r in relationships
            if r.source_entity_id == entity_id or r.target_entity_id == entity_id
        ]
    
    return {
        "success": True,
        "data": {
            "relationships": [r.dict() for r in relationships],
            "count": len(relationships)
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/canonical-locations")
async def get_canonical_locations(entity_ids: List[str]):
    """Get canonical file locations for entities"""
    entities = [
        knowledge_manager.entities.get(eid) 
        for eid in entity_ids 
        if eid in knowledge_manager.entities
    ]
    
    file_mappings = await knowledge_manager.determine_canonical_locations(entities)
    
    return {
        "success": True,
        "data": {
            "mappings": file_mappings
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/resolve-conflicts/{entity_id}")
async def resolve_entity_conflicts(entity_id: str):
    """Resolve conflicts in an entity's attributes"""
    entity = await knowledge_manager.resolve_conflicts(entity_id)
    
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")
    
    return {
        "success": True,
        "data": {
            "entity": entity.dict()
        },
        "timestamp": datetime.utcnow().isoformat()
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    print("🚀 KnowledgeOS Intelligence API starting...")
    print(f"📊 NLP available: {knowledge_manager.nlp is not None}")
    print("✅ Ready to accept connections")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("👋 Shutting down KnowledgeOS Intelligence API")


if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        app, 
        host="127.0.0.1", 
        port=8000,
        log_level="info"
    )