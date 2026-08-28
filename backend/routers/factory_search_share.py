"""Permissioned search-performance analysis handoff APIs."""
from typing import Any
from fastapi import APIRouter,Depends,HTTPException,Request
from pydantic import BaseModel,Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_search_share import FactorySearchShareService
from services.tenant_access import require_project_access,require_project_permission
router=APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/search-share",tags=["factory-platform-search-share"])
MANAGE="factory.trust.search-share.dataset.manage";VERIFY="factory.trust.search-share.snapshot.verify";APPROVE="factory.trust.search-share.release.approve";ACK="factory.trust.search-share.handoff.acknowledge"
class DatasetCreate(BaseModel):source_reference:str=Field(min_length=2,max_length=255);market:str=Field(min_length=2,max_length=80);search_engine:str=Field(min_length=2,max_length=40);device:str=Field(min_length=2,max_length=40);observed_from:str=Field(min_length=8,max_length=32);observed_to:str=Field(min_length=8,max_length=32)
class SnapshotCreate(BaseModel):performance_manifest:dict[str,Any]
class ReleaseCreate(BaseModel):target:str=Field(pattern="^(marketing-owner|executive-owner|seo-operations)$");analysis_manifest:dict[str,Any];rollback_reference:str=Field(min_length=1,max_length=255)
class RevisionReference(BaseModel):expected_revision:int=Field(gt=0);reference:str=Field(min_length=1,max_length=255)
def _fail(error):raise HTTPException(status_code=404 if isinstance(error,KeyError) else 409,detail=str(error)) from error
async def _run(db,request,user,project_id,permission,action,target_type,operation,*,context=False,**kwargs):
 await require_project_access(db,current_user=user,project_id=project_id);resolved=await require_project_permission(db,current_user=user,project_id=project_id,permission=permission)
 try:item=await operation(project_id=project_id,actor=user.id,**({"context":resolved.context} if context else {}),**kwargs)
 except(KeyError,ValueError)as error:_fail(error)
 record_audit_event(db,action=action,actor_user_id=user.id,project_id=project_id,target_type=target_type,target_id=str(item.get("id")),ip_address=request.client.host if request.client else None,detail={"project_id":project_id,"status":item.get("status"),"revision":item.get("revision")});await db.commit();return item
@router.get("")
async def workspace(project_id:int,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):
 await require_project_access(db,current_user=current_user,project_id=project_id);return await FactorySearchShareService(db).workspace(project_id=project_id)
@router.post("/datasets")
async def create_dataset(project_id:int,payload:DatasetCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.search-share.dataset.create","factory-search-share-dataset",FactorySearchShareService(db).create_dataset,context=True,**payload.model_dump())
@router.post("/datasets/{dataset_id}/snapshots")
async def capture_snapshot(project_id:int,dataset_id:str,payload:SnapshotCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.search-share.snapshot.capture","factory-search-share-snapshot",FactorySearchShareService(db).capture_snapshot,context=True,dataset_id=dataset_id,**payload.model_dump())
@router.post("/snapshots/{snapshot_id}/verify")
async def verify_snapshot(project_id:int,snapshot_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,VERIFY,"factory.search-share.snapshot.verify","factory-search-share-snapshot",FactorySearchShareService(db).verify_snapshot,snapshot_id=snapshot_id,expected_revision=payload.expected_revision,verification_reference=payload.reference)
@router.post("/snapshots/{snapshot_id}/releases")
async def prepare_release(project_id:int,snapshot_id:str,payload:ReleaseCreate,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,MANAGE,"factory.search-share.release.prepare","factory-search-share-release",FactorySearchShareService(db).prepare_release,context=True,snapshot_id=snapshot_id,**payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,APPROVE,"factory.search-share.release.approve","factory-search-share-release",FactorySearchShareService(db).approve_release,release_id=release_id,expected_revision=payload.expected_revision,approval_reference=payload.reference)
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge_release(project_id:int,release_id:str,payload:RevisionReference,request:Request,current_user:UserResponse=Depends(get_current_user),db:AsyncSession=Depends(get_db)):return await _run(db,request,current_user,project_id,ACK,"factory.search-share.handoff.acknowledge","factory-search-share-release",FactorySearchShareService(db).acknowledge_release,release_id=release_id,expected_revision=payload.expected_revision,consumer_receipt_reference=payload.reference)
