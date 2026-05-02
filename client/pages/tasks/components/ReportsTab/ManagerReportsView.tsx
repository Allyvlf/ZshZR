import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReportDetailModal from './ReportDetailModal'

interface ManagerReportsViewProps {
  reports: any[]
  currentUser: any
  isLoading: boolean
  onRefresh: () => void
}

export default function ManagerReportsView({
  reports,
  currentUser,
  isLoading,
  onRefresh,
}: ManagerReportsViewProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('pending')

  const submittedReports = reports.filter(r => r.status === 'submitted')
  const approvedReports = reports.filter(r => r.status === 'approved')
  const rejectedReports = reports.filter(r => r.status === 'rejected')
  const inProgressReports = reports.filter(r => r.status === 'in_progress')

  // Count reports with open issues
  const reportsWithOpenIssues = submittedReports.filter(r => {
    // This will be populated when we fetch task_issues
    return r.open_issues && r.open_issues > 0
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
      case 'submitted':
        return <Badge className="bg-amber-100 text-amber-800">Awaiting Review</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Needs Revision</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />
      case 'submitted':
        return <AlertCircle className="h-5 w-5 text-amber-600" />
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'rejected':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const ReportCard = ({ report, hasIssues = false }: { report: any; hasIssues?: boolean }) => (
    <Card
      className={cn('cursor-pointer hover:shadow-md transition-shadow', {
        'border-red-200 bg-red-50': hasIssues,
      })}
      onClick={() => setSelectedReport(report.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(report.status)}
              <CardTitle className="text-lg">{report.tasks?.title || 'Unknown Task'}</CardTitle>
              {hasIssues && (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <CardDescription className="mt-1">
              Provider: {report.provider?.first_name} {report.provider?.last_name}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(report.status)}
            {report.tasks?.priority && (
              <Badge
                className={cn({
                  'bg-red-100 text-red-800': report.tasks.priority === 'urgent',
                  'bg-orange-100 text-orange-800': report.tasks.priority === 'high',
                  'bg-blue-100 text-blue-800': report.tasks.priority === 'medium',
                  'bg-gray-100 text-gray-800': report.tasks.priority === 'low',
                })}
              >
                {report.tasks.priority}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="font-semibold">{report.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${report.progress_percentage}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Checklists</span>
              <div className="font-semibold">
                {report.total_checklist_items ? `${report.total_checklist_items}` : '—'}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Evidence</span>
              <div className="font-semibold">{report.evidence_count || 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Issues</span>
              <div className={cn('font-semibold', { 'text-red-600': report.open_issues > 0 })}>
                {report.open_issues || 0}
              </div>
            </div>
          </div>

          {report.submitted_at && (
            <p className="text-xs text-muted-foreground">
              Submitted: {new Date(report.submitted_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Task Reports</h2>
            <p className="text-muted-foreground mt-1">
              Review service provider reports, approve completed work, and manage task issues
            </p>
          </div>
          <Button onClick={onRefresh} variant="outline">
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              Awaiting Review {submittedReports.length > 0 && `(${submittedReports.length})`}
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              In Progress {inProgressReports.length > 0 && `(${inProgressReports.length})`}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved {approvedReports.length > 0 && `(${approvedReports.length})`}
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Needs Revision {rejectedReports.length > 0 && `(${rejectedReports.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {submittedReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No reports awaiting review</p>
                  <p className="text-sm mt-1">Service providers will submit reports here</p>
                </CardContent>
              </Card>
            ) : (
              submittedReports.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  hasIssues={report.open_issues && report.open_issues > 0}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-3">
            {inProgressReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No reports in progress</p>
                </CardContent>
              </Card>
            ) : (
              inProgressReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-3">
            {approvedReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No approved reports yet</p>
                </CardContent>
              </Card>
            ) : (
              approvedReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-3">
            {rejectedReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No reports rejected</p>
                </CardContent>
              </Card>
            ) : (
              rejectedReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedReport && (
        <ReportDetailModal
          reportId={selectedReport}
          userRole="manager"
          currentUser={currentUser}
          onClose={() => setSelectedReport(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}
