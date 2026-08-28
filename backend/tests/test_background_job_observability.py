import asyncio

from services.background_jobs import (
    acknowledge_background_job,
    background_job_queue_metrics,
    background_job_result,
    claim_background_job,
    enqueue_background_job,
)


def test_local_verification_job_has_queue_metrics_and_a_result(monkeypatch):
    async def scenario():
        monkeypatch.setenv("RATE_LIMIT_BACKEND", "memory")
        job = await enqueue_background_job("backup_verify", {"backup_path": "D:/safe/backup.sqlite3"})
        before = await background_job_queue_metrics()
        assert before["backend"] == "memory-local"
        assert before["queued"] >= 1

        claimed = await claim_background_job(timeout_seconds=0)
        assert claimed is not None
        queued_job, raw = claimed
        assert queued_job["id"] == job["id"]
        await acknowledge_background_job(raw, {"status": "completed", "verification": "verified"})

        result = await background_job_result(job["id"])
        assert result is not None and result["verification"] == "verified"

    asyncio.run(scenario())
