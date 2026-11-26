'use client'

import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NextLink from 'next/link'
import {
  Briefcase,
  Building2,
  MapPin,
  Loader2,
  Sparkles,
  Undo2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { apiUrl } from '@/lib/api'

export interface TargetJob {
  id: string
  board_id: string
  title: string
  company: string
  location: string
  description: string
}

interface JobBoardSummary {
  id: string
  name: string
  job_count: number
}

interface JobEntry {
  id: string
  title: string
  company: string
  location: string
  description: string
}

interface ResumeTargetJobProps {
  job: TargetJob | null
  onChange: (job: TargetJob | null) => void
  onTailor: () => void
  isTailoring: boolean
  canUndo: boolean
  onUndo: () => void
}

/**
 * Bar above the resume editor for attaching a job from the user's job boards
 * and refining the whole resume against that job's description.
 */
export default function ResumeTargetJob({
  job,
  onChange,
  onTailor,
  isTailoring,
  canUndo,
  onUndo,
}: ResumeTargetJobProps) {
  const { t } = useTranslation()
  const [boards, setBoards] = useState<JobBoardSummary[]>([])
  const [boardId, setBoardId] = useState(job?.board_id ?? '')
  const [boardJobs, setBoardJobs] = useState<JobEntry[]>([])
  const [loadingBoards, setLoadingBoards] = useState(true)
  const [picking, setPicking] = useState(!job)
  const [showDescription, setShowDescription] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/api/v1/jobs/list'))
      .then(res => (res.ok ? res.json() : { boards: [] }))
      .then(data => {
        const list: JobBoardSummary[] = data.boards || []
        setBoards(list)
        if (!boardId && list.length > 0) setBoardId(list[0].id)
      })
      .catch(() => setBoards([]))
      .finally(() => setLoadingBoards(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restored jobs (from localStorage) carry their board id; keep the picker in sync.
  useEffect(() => {
    if (job?.board_id) setBoardId(job.board_id)
    setPicking(!job)
  }, [job])

  useEffect(() => {
    if (!boardId) {
      setBoardJobs([])
      return
    }
    fetch(apiUrl(`/api/v1/jobs/${boardId}`))
      .then(res => (res.ok ? res.json() : { jobs: [] }))
      .then(data => setBoardJobs(data.jobs || []))
      .catch(() => setBoardJobs([]))
  }, [boardId])

  const selectJob = (jobId: string) => {
    const entry = boardJobs.find(j => j.id === jobId)
    if (!entry) return
    onChange({
      id: entry.id,
      board_id: boardId,
      title: entry.title,
      company: entry.company,
      location: entry.location || '',
      description: entry.description || '',
    })
  }

  const selectClass =
    'px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-50 min-w-0'

  const hasDescription = !!job?.description.trim()

  return (
    <div className="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider shrink-0">
          <Briefcase className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          {t('Target Job')}
        </div>

        {job && !picking ? (
          <>
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {job.title}
              </span>
              {job.company && (
                <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                  <Building2 className="w-3 h-3" /> {job.company}
                </span>
              )}
              {job.location && (
                <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3 h-3" /> {job.location}
                </span>
              )}
              {hasDescription && (
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showDescription ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {t('Job description')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setPicking(true)}
                className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                {t('Change')}
              </button>
              <button
                onClick={() => onChange(null)}
                title={t('Detach job')}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {canUndo && (
                <button
                  onClick={onUndo}
                  disabled={isTailoring}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {t('Undo')}
                </button>
              )}
              <button
                onClick={onTailor}
                disabled={isTailoring || !hasDescription}
                title={
                  hasDescription
                    ? t('Refine the whole resume for this job')
                    : t('This job has no description. Add one on the Jobs page.')
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-xs font-bold rounded-lg hover:from-indigo-700 hover:to-cyan-700 shadow-sm disabled:opacity-50"
              >
                {isTailoring ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isTailoring ? t('Tailoring...') : t('Tailor Resume')}
              </button>
            </div>
          </>
        ) : loadingBoards ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : boards.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('No saved jobs yet.')}{' '}
            <NextLink href="/jobs" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('Add a job on the Jobs page')}
            </NextLink>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <select
              value={boardId}
              onChange={e => setBoardId(e.target.value)}
              className={selectClass}
            >
              {boards.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.job_count})
                </option>
              ))}
            </select>
            <select
              value=""
              onChange={e => selectJob(e.target.value)}
              disabled={boardJobs.length === 0}
              className={`${selectClass} flex-1 max-w-md`}
            >
              <option value="">
                {boardJobs.length === 0 ? t('No jobs on this board') : t('Select a job...')}
              </option>
              {boardJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title} — {j.company}
                </option>
              ))}
            </select>
            {job && (
              <button
                onClick={() => setPicking(false)}
                className="px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                {t('Cancel')}
              </button>
            )}
            {!job && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {t('Attach a job to tailor your resume to its description.')}
              </span>
            )}
          </div>
        )}
      </div>

      {job && !picking && showDescription && hasDescription && (
        <div className="mt-2 max-h-40 overflow-y-auto text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-2">
          {job.description}
        </div>
      )}
    </div>
  )
}
