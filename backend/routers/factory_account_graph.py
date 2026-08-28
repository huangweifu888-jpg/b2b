"""Tenant-scoped governed B2B account relationship graph APIs."""
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_account_graph import FactoryAccountGraphService
from services.tenant_access import require_project_access,require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/account-graph",tags=["factory-platform-account-graph"])
GRAPH_MANAGE="factory.portrait.account.graph.manage";NODE_VERIFY="factory.portrait.account.node.verify";EDGE_MANAGE="factory.portrait.account.relation.manage";EDGE_VERIFY="factory.portrait.account.relation.verify";PUBLISH="factory.portrait.account.publish";ACK="factory.portrait.account.handoff.acknowledge"

class GraphCreate(BaseModel):
    graph_code:str=Field(min_length=1,max_length=64);graph_name:str=Field(min_length=1,max_length=180);scope:Literal["account-360","channel-network","opportunity-network"]
class NodeCreate(BaseModel):
    source_type:Literal["legal-party","golden-profile","identity-signal","cpq-quote","fulfillment-order"];source_id:str=Field(min_length=1,max_length=100)
class EdgeCreate(BaseModel):
    from_node_id:str=Field(min_length=1,max_length=100);to_node_id:str=Field(min_length=1,max_length=100);relation_type:Literal["parent-of","branch-of","distributor-of","contact-at","has-opportunity","fulfills","identity-of"];strength:Literal["weak","medium","strong"];evidence_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):
    expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
class PublishGraph(BaseModel):
    expected_revision:int=Field(gt=0);consumers:list[Literal["crm","cdp","sales","service"]]=Field(min_length=1,max_length=4);delivery_reference_prefix:str=Field(min_length=1,max_length=180)

def _raise(exc):
    if isinstance(exc,KeyError):raise HTTPException(status_code=404,detail=str(exc)) from exc
    raise HTTPException(status_code=409,detail=str(exc)) from exc
def _item(payload):
    if isinstance(payload,dict):
        for key in ("graph","version"):
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
    await require_project_access(db,current_user=current_user,project_id=project_id);return await FactoryAccountGraphService(db).list_workspace(project_id=project_id)
@router.post("/graphs")
async def create_graph(project_id:int,payload:GraphCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,GRAPH_MANAGE,"factory.account.graph.create","factory-account-graph",FactoryAccountGraphService(db).create_graph,context=True,**payload.model_dump())
@router.post("/graphs/{graph_id}/nodes")
async def create_node(project_id:int,graph_id:str,payload:NodeCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,GRAPH_MANAGE,"factory.account.node.create","factory-account-graph-node",FactoryAccountGraphService(db).add_node,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/nodes/{node_id}/verify")
async def verify_node(project_id:int,node_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,NODE_VERIFY,"factory.account.node.verify","factory-account-graph-node",FactoryAccountGraphService(db).verify_node,node_id=node_id,**payload.model_dump())
@router.post("/graphs/{graph_id}/edges")
async def create_edge(project_id:int,graph_id:str,payload:EdgeCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,EDGE_MANAGE,"factory.account.relation.create","factory-account-graph-edge",FactoryAccountGraphService(db).add_edge,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/edges/{edge_id}/verify")
async def verify_edge(project_id:int,edge_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,EDGE_VERIFY,"factory.account.relation.verify","factory-account-graph-edge",FactoryAccountGraphService(db).verify_edge,edge_id=edge_id,**payload.model_dump())
@router.post("/graphs/{graph_id}/publish")
async def publish_graph(project_id:int,graph_id:str,payload:PublishGraph,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,PUBLISH,"factory.account.graph.publish","factory-account-graph",FactoryAccountGraphService(db).publish_graph,context=True,graph_id=graph_id,**payload.model_dump())
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id:int,publication_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.account.publication.acknowledge","factory-account-graph-publication",FactoryAccountGraphService(db).acknowledge_publication,publication_id=publication_id,**payload.model_dump())
