import React, { useState } from 'react'
import { TaskReport, UserProfile } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react'
import ReportDetailModal from './ReportDetailModal'
import { cn } from '@/lib/utils'

interface ServiceProviderReportsViewProps {
  reports: any[]
  currentUserProfile: UserProfile | null
  currentUser: any
  isLoading: boolean
  onRefresh: () => void
}

export default function ServiceProviderReportsView({
  reports,
  currentUserProfile,
  currentUser,
  isLoading,
  onRefresh,
}: ServiceProviderReportsViewProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('in-progress')

  const inProgressReports = reports.filter(r => r.status === 'in_progress')
  const submittedReports = reports.filter(r => r.status === 'submitted')
  const completedReports = reports.filter(r => r.status === 'approved' || r.status === 'rejected')

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
        return <Send className="h-5 w-5 text-amber-600" />
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return null
    }
  }

  const ReportCard = ({ report }: { report: any }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedReport(report.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(report.status)}
              <CardTitle className="text-lg">{report.tasks?.title || 'Unknown Task'}</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Due: {report.tasks?.due_date ? new Date(report.tasks.due_date).toLocaleDateString() : 'No due date'}
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
        <div className="space-y-2">
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
          {report.summary && (
            <p className="text-sm text-muted-foreground mt-3">{report.summary}</p>
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
            <h2 className="text-2xl font-bold">Your Task Reports</h2>
            <p className="text-muted-foreground mt-1">
              Track progress on your assigned tasks and submit reports to managers
            </p>
          </div>
          <Button onClick={onRefresh} variant="outline">
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="in-progress">
              In Progress {inProgressReports.length > 0 && `(${inProgressReports.length})`}
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Awaiting Review {submittedReports.length > 0 && `(${submittedReports.length})`}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed {completedReports.length > 0 && `(${completedReports.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in-progress" className="space-y-3">
            {inProgressReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No reports in progress</p>
                  <p className="text-sm mt-1">
                    When tasks are assigned and marked as in progress, they will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              inProgressReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          <TabsContent value="submitted" className="space-y-3">
            {submittedReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No reports awaiting review</p>
                </CardContent>
              </Card>
            ) : (
              submittedReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedReports.length === 0 ? (
              <Card className="bg-muted/50">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No completed reports</p>
                </CardContent>
              </Card>
            ) : (
              completedReports.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {selectedReport && (
        <ReportDetailModal
          reportId={selectedReport}
          userRole="service_provider"
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          onClose={() => setSelectedReport(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}
