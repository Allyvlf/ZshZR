import React, { useState, useEffect } from 'react'
import { supabase, TaskReport, UserProfile } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  MapPin,
  FileText,
  Image as ImageIcon,
  Video,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import ChecklistSection from './ChecklistSection'
import EvidenceSection from './EvidenceSection'
import IssueSection from './IssueSection'
import ActivityTimeline from './ActivityTimeline'

interface ReportDetailModalProps {
  reportId: string
  userRole: 'manager' | 'service_provider'
  currentUser: any
  currentUserProfile?: UserProfile | null
  onClose: () => void
  onRefresh: () => void
}

export default function ReportDetailModal({
  reportId,
  userRole,
  currentUser,
  currentUserProfile,
  onClose,
  onRefresh,
}: ReportDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Fetch report with all related data
  const reportQuery = useQuery({
    queryKey: ['task-report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_reports')
        .select(
          `
          *,
          tasks:task_id (
            id, title, description, priority, status, due_date,
            assigned_to, category, budget, created_by, estimated_time
          ),
          provider:provider_id (
            id, first_name, last_name, service_type, service_category
          )
        `
        )
        .eq('id', reportId)
        .single()

      if (error) {
        console.error('Error fetching report:', error)
        return null
      }

      return data
    },
  })

  const report = reportQuery.data as any

  const handleApprove = async () => {
    if (!report) return

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Update report status to approved
      const { error: updateError } = await supabase
        .from('task_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id,
          approval_notes: approvalNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)

      if (updateError) throw updateError

      // Log activity
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'approved',
        actor_id: currentUser.id,
        actor_role: 'manager',
        details: { notes: approvalNotes },
      })

      onRefresh()
      onClose()
    } catch (error) {
      console.error('Error approving report:', error)
      setErrorMessage('Failed to approve report')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!report || !rejectionReason.trim()) {
      setErrorMessage('Please provide a reason for rejection')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Update report status to rejected
      const { error: updateError } = await supabase
        .from('task_reports')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: currentUser.id,
          rejection_reason: rejectionReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)

      if (updateError) throw updateError

      // Log activity
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'rejected',
        actor_id: currentUser.id,
        actor_role: 'manager',
        details: { reason: rejectionReason },
      })

      onRefresh()
      onClose()
    } catch (error) {
      console.error('Error rejecting report:', error)
      setErrorMessage('Failed to reject report')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitReport = async () => {
    if (!report) return

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      // Update report status to submitted
      const { error: updateError } = await supabase
        .from('task_reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_notes: approvalNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)

      if (updateError) throw updateError

      // Log activity
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'submitted',
        actor_id: currentUser.id,
        actor_role: 'service_provider',
        details: { notes: approvalNotes },
      })

      onRefresh()
      onClose()
    } catch (error) {
      console.error('Error submitting report:', error)
      setErrorMessage('Failed to submit report')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (reportQuery.isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading report...</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!report) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Not Found</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">The requested report could not be loaded.</p>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const canApproveOrReject = userRole === 'manager' && report.status === 'submitted'
  const canSubmit = userRole === 'service_provider' && report.status === 'in_progress'
  const showApprovalUI = report.status === 'submitted' && userRole === 'manager'
  const showRejectionDetails = report.status === 'rejected'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{report.tasks?.title}</DialogTitle>
              <DialogDescription className="mt-2">
                Service Provider: {report.provider?.first_name} {report.provider?.last_name}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Progress Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">Report Status</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {report.status === 'in_progress' && (
                      <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                    )}
                    {report.status === 'submitted' && (
                      <Badge className="bg-amber-100 text-amber-800">Awaiting Review</Badge>
                    )}
                    {report.status === 'approved' && (
                      <Badge className="bg-green-100 text-green-800">Approved</Badge>
                    )}
                    {report.status === 'rejected' && (
                      <Badge className="bg-red-100 text-red-800">Needs Revision</Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Overall Progress</div>
                  <div className="text-3xl font-bold">{report.progress_percentage}%</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${report.progress_percentage}%` }}
                />
              </div>
            </CardHeader>
          </Card>

          {/* Error Alert */}
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Rejection Details */}
          {showRejectionDetails && report.rejection_reason && (
            <Alert variant="destructive" className="bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Revision Needed</div>
                <p>{report.rejection_reason}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Task Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Priority</span>
                      <Badge
                        className={`mt-1 ${
                          report.tasks?.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : report.tasks?.priority === 'high'
                              ? 'bg-orange-100 text-orange-800'
                              : report.tasks?.priority === 'medium'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {report.tasks?.priority}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Category</span>
                      <p className="mt-1 font-medium">{report.tasks?.category || '—'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Due Date</span>
                      <p className="mt-1 font-medium">
                        {report.tasks?.due_date
                          ? new Date(report.tasks.due_date).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Budget</span>
                      <p className="mt-1 font-medium">
                        {report.tasks?.budget ? `$${report.tasks.budget.toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{report.tasks?.description}</p>
                </CardContent>
              </Card>

              {/* Service Provider Summary (from report) */}
              {report.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Work Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{report.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Submission Details */}
              {report.status !== 'in_progress' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {report.status === 'submitted' ? 'Submitted' : 'Reviewed'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {report.submitted_at && (
                      <div>
                        <span className="text-sm text-muted-foreground">Submission Date</span>
                        <p className="mt-1 font-medium">
                          {new Date(report.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {report.submitted_notes && (
                      <div>
                        <span className="text-sm text-muted-foreground">Notes</span>
                        <p className="mt-1">{report.submitted_notes}</p>
                      </div>
                    )}
                    {report.status === 'approved' && report.approved_at && (
                      <div>
                        <span className="text-sm text-muted-foreground">Approved</span>
                        <p className="mt-1 font-medium">
                          {new Date(report.approved_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist">
              <ChecklistSection
                reportId={reportId}
                taskId={report.task_id}
                userRole={userRole}
                currentUser={currentUser}
                isReportLocked={report.status !== 'in_progress' && report.status !== 'rejected'}
                onActivityLogged={() => reportQuery.refetch()}
              />
            </TabsContent>

            {/* Evidence Tab */}
            <TabsContent value="evidence">
              <EvidenceSection
                reportId={reportId}
                taskId={report.task_id}
                userRole={userRole}
                currentUser={currentUser}
                isReportLocked={report.status !== 'in_progress' && report.status !== 'rejected'}
                onEvidenceAdded={() => reportQuery.refetch()}
              />
            </TabsContent>

            {/* Issues Tab */}
            <TabsContent value="issues">
              <IssueSection
                reportId={reportId}
                taskId={report.task_id}
                userRole={userRole}
                currentUser={currentUser}
                isReportLocked={report.status !== 'in_progress' && report.status !== 'rejected'}
                onIssueCreated={() => reportQuery.refetch()}
              />
            </TabsContent>
          </Tabs>

          {/* Activity Timeline */}
          <Tabs value="activity" defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="activity">
              <ActivityTimeline reportId={reportId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="space-y-3">
          {showApprovalUI && (
            <div className="space-y-3 w-full">
              <Textarea
                placeholder="Add approval notes (optional)..."
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="min-h-20"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="destructive"
                  onClick={() => setActiveTab('rejection')}
                  disabled={isSubmitting}
                >
                  Reject & Request Changes
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? 'Approving...' : 'Approve Report'}
                </Button>
              </div>
            </div>
          )}

          {/* Rejection Form - shown as a separate view */}
          {showApprovalUI && activeTab === 'rejection' && (
            <div className="space-y-3 w-full">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Rejecting this report will send it back to the service provider for revision.
                </AlertDescription>
              </Alert>
              <Textarea
                placeholder="Explain what needs to be revised..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="min-h-24"
                required
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('overview')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isSubmitting || !rejectionReason.trim()}
                >
                  {isSubmitting ? 'Rejecting...' : 'Reject & Send Back'}
                </Button>
              </div>
            </div>
          )}

          {canSubmit && (
            <div className="space-y-3 w-full">
              <Textarea
                placeholder="Add submission notes (optional)..."
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="min-h-20"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Continue Working
                </Button>
                <Button
                  onClick={handleSubmitReport}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report to Manager'}
                </Button>
              </div>
            </div>
          )}

          {!canApproveOrReject && !canSubmit && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
