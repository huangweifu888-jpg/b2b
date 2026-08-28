"""Tenant-scoped enterprise knowledge graph APIs."""
from typing import Literal
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_knowledge_graph import FactoryKnowledgeGraphService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/knowledge-graph",tags=["factory-platform-knowledge-graph"])
GRAPH_MANAGE="factory.recommend.knowledge.graph.manage";ENTITY_VERIFY="factory.recommend.knowledge.entity.verify";RELATION_MANAGE="factory.recommend.knowledge.relation.manage";RELATION_VERIFY="factory.recommend.knowledge.relation.verify";PUBLISH="factory.recommend.knowledge.publish";ACK="factory.recommend.knowledge.handoff.acknowledge"
class GraphCreate(BaseModel):graph_code:str=Field(min_length=1,max_length=64);graph_name:str=Field(min_length=1,max_length=180);scope:Literal["enterprise","brand","global-product"];default_locale:str=Field(min_length=2,max_length=16);objective:str=Field(min_length=12,max_length=4000)
class EntityCreate(BaseModel):entity_key:str=Field(min_length=1,max_length=160);entity_type:Literal["organization","product","capability","certificate","case","market"];canonical_name:str=Field(min_length=1,max_length=255);aliases:list[str]=Field(default_factory=list,max_length=100);properties:dict;locale:str=Field(min_length=2,max_length=16);source_type:Literal["legal-party","product-passport","passport-certificate","dam-asset","icp-profile"];source_id:str=Field(min_length=1,max_length=100);evidence_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class RelationCreate(BaseModel):subject_entity_id:str=Field(min_length=1,max_length=100);predicate:str=Field(min_length=1,max_length=100);object_entity_id:str=Field(min_length=1,max_length=100);evidence_reference:str=Field(min_length=1,max_length=255)
class PublishGraph(BaseModel):expected_revision:int=Field(gt=0);consumer:Literal["geo","schema","ai-search","commerce","sales-enablement"];delivery_reference:str=Field(min_length=1,max_length=255)
def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc
def _item(payload):
    if isinstance(payload,dict):
        for key in ("graph","version","publication"):
            if isinstance(payload.get(key),dict):return payload[key]
    return payload
def _audit(db,request,user,action,target_type,item,project_id):
    item=_item(item);record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item["id"]),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")})
async def _run(db,request,user,project_id,permission,action,target_type,method,*,context=False,**kwargs):
    resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
    try:result=await method(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
    except (KeyError,ValueError) as exc:_raise(exc)
    _audit(db,request,user,action,target_type,result,project_id);await db.commit();return result
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryKnowledgeGraphService(db).list_workspace(project_id=project_id)
@router.post("/graphs")
async def create_graph(project_id:int,payload:GraphCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,GRAPH_MANAGE,"factory.knowledge.graph.create","factory-knowledge-graph",FactoryKnowledgeGraphService(db).create_graph,context=True,**payload.model_dump())
@router.post("/graphs/{graph_id}/entities")
async def add_entity(project_id:int,graph_id:str,payload:EntityCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,GRAPH_MANAGE,"factory.knowledge.entity.ingest","factory-knowledge-entity",FactoryKnowledgeGraphService(db).add_entity,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/entities/{entity_id}/verify")
async def verify_entity(project_id:int,entity_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ENTITY_VERIFY,"factory.knowledge.entity.verify","factory-knowledge-entity",FactoryKnowledgeGraphService(db).verify_entity,entity_id=entity_id,expected_revision=payload.expected_revision,reference=payload.reference)
@router.post("/graphs/{graph_id}/relations")
async def add_relation(project_id:int,graph_id:str,payload:RelationCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,RELATION_MANAGE,"factory.knowledge.relation.create","factory-knowledge-relation",FactoryKnowledgeGraphService(db).add_relation,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/relations/{relation_id}/verify")
async def verify_relation(project_id:int,relation_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,RELATION_VERIFY,"factory.knowledge.relation.verify","factory-knowledge-relation",FactoryKnowledgeGraphService(db).verify_relation,relation_id=relation_id,expected_revision=payload.expected_revision,reference=payload.reference)
@router.post("/graphs/{graph_id}/publish")
async def publish_graph(project_id:int,graph_id:str,payload:PublishGraph,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.knowledge.graph.publish","factory-knowledge-graph",FactoryKnowledgeGraphService(db).publish_graph,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.knowledge.publication.acknowledge","factory-knowledge-publication",FactoryKnowledgeGraphService(db).acknowledge_publication,publication_id=publication_id,expected_revision=payload.expected_revision,reference=payload.reference)
