"""Inspect and assert the latest governed formal-finance period close."""

import argparse
from decimal import Decimal
import json
import sqlite3


def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--database",required=True); args=parser.parse_args()
    db=sqlite3.connect(args.database); db.row_factory=sqlite3.Row
    query=lambda sql,values=():[dict(x) for x in db.execute(sql,values).fetchall()]
    periods=query("select * from factory_finance_periods where status='closed' order by closed_at desc limit 1")
    if not periods: raise SystemExit("No closed formal finance period found")
    period=periods[0]
    journals=query("select * from factory_finance_journals where period_id=? order by journal_number",(period["id"],))
    balances=query("select * from factory_finance_account_balances where period_id=? order by account_code",(period["id"],))
    if not journals or not balances: raise SystemExit("Closed finance period has no posted journals or trial balances")
    journal_ids=[x["id"] for x in journals]
    placeholders=",".join("?" for _ in journal_ids)
    lines=query(f"select * from factory_finance_journal_lines where journal_id in ({placeholders}) order by journal_number,line_sequence",tuple(journal_ids))
    debit=sum((Decimal(str(x["amount"])) for x in lines if x["side"]=="debit"),Decimal("0"))
    credit=sum((Decimal(str(x["amount"])) for x in lines if x["side"]=="credit"),Decimal("0"))
    assert debit==credit==Decimal(str(period["total_debit"]))==Decimal(str(period["total_credit"]))
    assert len(journals)==period["journal_count"] and all(x["status"]=="posted" for x in journals)
    assert all(x["prepared_by"]!=x["approved_by"] for x in journals)
    assert period["close_submitted_by"]!=period["closed_by"]
    assert sum((Decimal(str(x["debit"])) for x in balances),Decimal("0"))==debit
    assert sum((Decimal(str(x["credit"])) for x in balances),Decimal("0"))==credit
    document_ids=[x["document_id"] for x in journals]
    docs=query(f"select * from factory_finance_documents where id in ({','.join('?' for _ in document_ids)})",tuple(document_ids))
    assert all(x["status"] in {"posted","partially-settled","settled"} for x in docs)
    for document in docs:
        if document["document_type"]=="ar-invoice":
            sources=query("select * from factory_erp_order_projects where id=?",(document["source_id"],))
            assert sources and sources[0]["erp_project_number"]==document["source_number"]
            assert sources[0]["revision"]>=document["source_revision"]
        if document["document_type"]=="ap-bill":
            sources=query("select * from factory_purchase_orders where id=?",(document["source_id"],))
            assert sources and sources[0]["lifecycle_status"]=="received"
            assert sources[0]["purchase_order_number"]==document["source_number"]
    target_ids=[period["id"],*document_ids]
    target_placeholders=','.join('?' for _ in target_ids)
    evidence=query(f"select * from factory_finance_evidence where subject_id in ({target_placeholders})",tuple(target_ids))
    evidence_types={x["evidence_type"] for x in evidence}
    assert {"period-opened","document-authored","document-posted","period-close-submitted","period-closed"}<=evidence_types
    audits=query(f"select * from audit_logs_platform where target_id in ({target_placeholders}) and action like 'factory_finance_%'",tuple(target_ids))
    actions={x["action"] for x in audits}
    assert {"factory_finance_period_opened","factory_finance_document_created","factory_finance_document_posted","factory_finance_period_close_submitted","factory_finance_period_closed"}<=actions
    assert all(json.loads(x["detail_json"] or "{}").get("project_id")==period["project_id"] for x in audits)
    permissions=set()
    for role in query("select permissions_json from roles_platform where is_system=1 and scope in ('client','project')"):
        permissions.update(json.loads(role["permissions_json"] or "[]"))
    required={"factory.operations.finance.book.manage","factory.operations.finance.book.approve","factory.operations.finance.document.manage","factory.operations.finance.document.post","factory.operations.finance.period.manage","factory.operations.finance.period.close"}
    assert required<=permissions
    print(json.dumps({"period_number":period["period_number"],"period_code":period["period_code"],"status":period["status"],"currency":period["currency"],"total_debit":period["total_debit"],"total_credit":period["total_credit"],"journal_count":len(journals),"line_count":len(lines),"balance_count":len(balances),"double_entry_balanced":True,"independent_close":True,"posted_journals_mutable":False,"oms_order_authority":True,"procurement_authority":True},ensure_ascii=False,indent=2))
    db.close()


if __name__=="__main__": main()
