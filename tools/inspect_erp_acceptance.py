"""Inspect and assert the latest governed ERP operating-ledger close."""

import argparse
from decimal import Decimal
import json
import sqlite3


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--database",required=True); args=parser.parse_args()
    db=sqlite3.connect(args.database); db.row_factory=sqlite3.Row
    query=lambda sql,values=():[dict(x) for x in db.execute(sql,values).fetchall()]
    periods=query("select * from factory_erp_periods where status='closed' order by closed_at desc limit 1")
    if not periods: raise SystemExit("No closed ERP operating period found")
    period=periods[0]
    postings=query("select * from factory_erp_postings where period_id=? order by posting_number",(period["id"],))
    balances=query("select * from factory_erp_period_balances where period_id=? order by balance_number",(period["id"],))
    if not postings or not balances: raise SystemExit("Closed ERP period has no immutable postings or balances")
    assert all(x["status"]=="posted" for x in postings)
    inflow=sum((Decimal(str(x["amount"])) for x in postings if x["direction"]=="inflow"),Decimal("0"))
    outflow=sum((Decimal(str(x["amount"])) for x in postings if x["direction"]=="outflow"),Decimal("0"))
    assert inflow==Decimal(str(period["total_inflow"])) and outflow==Decimal(str(period["total_outflow"]))
    assert inflow-outflow==Decimal(str(period["net_result"])) and len(postings)==period["posting_count"]
    assert sum((Decimal(str(x["inflow"])) for x in balances),Decimal("0"))==inflow
    assert sum((Decimal(str(x["outflow"])) for x in balances),Decimal("0"))==outflow
    assert period["close_submitted_by"]!=period["closed_by"]
    projects=query("select * from factory_erp_order_projects where id in (%s)" % ",".join("?" for _ in {x["order_project_id"] for x in postings}),tuple({x["order_project_id"] for x in postings}))
    for project in projects:
        orders=query("select * from factory_fulfillment_orders where id=?",(project["order_id"],))
        assert orders and orders[0]["status"] in {"confirmed","allocated","picked","packed","shipped","delivered"}
        assert project["order_number"]==orders[0]["order_number"] and project["order_revision"]<=orders[0]["revision"]
    evidence=query("select * from factory_erp_evidence where subject_id in (%s)" % ",".join("?" for _ in [period["id"],*[x["id"] for x in postings]]),tuple([period["id"],*[x["id"] for x in postings]]))
    evidence_types={x["evidence_type"] for x in evidence}
    assert {"period-opened","posting-authored","posting-submitted","posting-posted","period-close-submitted","period-closed"}<=evidence_types
    target_ids=[period["id"],*[x["id"] for x in postings]]
    audits=query("select * from audit_logs_platform where target_id in (%s) and action like 'factory_erp_%%'" % ",".join("?" for _ in target_ids),tuple(target_ids))
    actions={x["action"] for x in audits}
    assert {"factory_erp_period_opened","factory_erp_posting_created","factory_erp_posting_submitted","factory_erp_posting_posted","factory_erp_period_close_submitted","factory_erp_period_closed"}<=actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id")==period["project_id"] for x in audits)
    permissions=set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required={"factory.operations.erp.master.manage","factory.operations.erp.master.approve","factory.operations.erp.order-project.register","factory.operations.erp.posting.manage","factory.operations.erp.posting.approve","factory.operations.erp.period.manage","factory.operations.erp.period.close"}
    assert required<=permissions
    print(json.dumps({"period_number":period["period_number"],"period_code":period["period_code"],"status":period["status"],"currency":period["currency"],"total_inflow":period["total_inflow"],"total_outflow":period["total_outflow"],"net_result":period["net_result"],"posting_count":len(postings),"balance_count":len(balances),"independent_close":True,"oms_order_authority":True,"formal_financial_general_ledger":False,"posted_records_mutable":False},ensure_ascii=False,indent=2))
    db.close()


if __name__=="__main__": main()
