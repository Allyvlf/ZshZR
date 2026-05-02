import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, AlertCircle, Loader2, Plus } from 'lucide-react'

interface IssueSectionProps {
  reportId: string
  taskId: string
  userRole: 'manager' | 'service_provider'
  currentUser: any
  isReportLocked: boolean
  onIssueCreated?: () => void
}

export default function IssueSection({
  reportId,
  taskId,
  userRole,
  currentUser,
  isReportLocked,
  onIssueCreated,
}: IssueSectionProps) {
  const [showNewIssueForm, setShowNewIssueForm] = useState(false)
  const [issueTitle, setIssueTitle] = useState('')
  const [issueDescription, setIssueDescription] = useState('')
  const [issueSeverity, setIssueSeverity] = useState('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({})

  // Fetch issues
  const issuesQuery = useQuery({
    queryKey: ['task-issues', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_issues')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching issues:', error)
        return []
      }

      return data || []
    },
  })

  const issues = issuesQuery.data || []

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!issueTitle.trim() || !issueDescription.trim()) {
      alert('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    try {
      await supabase.from('task_issues').insert({
        report_id: reportId,
        title: issueTitle,
        description: issueDescription,
        severity: issueSeverity as 'low' | 'medium' | 'high' | 'critical',
        status: 'open',
        created_by: currentUser.id,
      })

      // Log activity
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'issue_raised',
        actor_id: currentUser.id,
        actor_role: 'service_provider',
        details: {
          issue_title: issueTitle,
          severity: issueSeverity,
        },
      })

      setIssueTitle('')
      setIssueDescription('')
      setIssueSeverity('medium')
      setShowNewIssueForm(false)

      issuesQuery.refetch()
      onIssueCreated?.()
    } catch (error) {
      console.error('Error creating issue:', error)
      alert('Failed to create issue')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResolveIssue = async (issueId: string) => {
    const notes = resolutionNotes[issueId] || ''

    if (!notes.trim()) {
      alert('Please add resolution notes')
      return
    }

    try {
      await supabase
        .from('task_issues')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      // Log activity
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'issue_resolved',
        actor_id: currentUser.id,
        actor_role: 'manager',
        details: {
          issue_id: issueId,
          resolution_notes: notes,
        },
      })

      setResolutionNotes(prev => {
        const updated = { ...prev }
        delete updated[issueId]
        return updated
      })

      issuesQuery.refetch()
    } catch (error) {
      console.error('Error resolving issue:', error)
      alert('Failed to resolve issue')
    }
  }

  const handleAcknowledgeIssue = async (issueId: string) => {
    try {
      await supabase
        .from('task_issues')
        .update({
          status: 'acknowledged',
          assigned_to: currentUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      issuesQuery.refetch()
    } catch (error) {
      console.error('Error acknowledging issue:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800'
      case 'acknowledged':
        return 'bg-amber-100 text-amber-800'
      case 'in_resolution':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const openIssues = issues.filter(
    i => i.status === 'open' || i.status === 'acknowledged' || i.status === 'in_resolution'
  )
  const resolvedIssues = issues.filter(i => i.status === 'resolved')

  return (
    <div className="space-y-4">
      {/* Issues Summary */}
      {openIssues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {openIssues.length} issue{openIssues.length !== 1 ? 's' : ''} reported on this
            task. Please review and address them.
          </AlertDescription>
        </Alert>
      )}

      {/* Create New Issue Form */}
      {userRole === 'service_provider' && !isReportLocked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Report an Issue or Challenge
            </CardTitle>
            <CardDescription>
              Let your manager know if you encounter any problems or blockers
            </CardDescription>
          </CardHeader>

          {showNewIssueForm ? (
            <CardContent>
              <form onSubmit={handleCreateIssue} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Issue Title</label>
                  <Input
                    value={issueTitle}
                    onChange={e => setIssueTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <Textarea
                    value={issueDescription}
                    onChange={e => setIssueDescription(e.target.value)}
                    placeholder="Detailed explanation of the issue and its impact"
                    className="min-h-24"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Severity</label>
                  <Select value={issueSeverity} onValueChange={setIssueSeverity} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                      <SelectItem value="medium">
                        Medium - Affects progress slightly
                      </SelectItem>
                      <SelectItem value="high">
                        High - Blocks progress significantly
                      </SelectItem>
                      <SelectItem value="critical">
                        Critical - Prevents task completion
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewIssueForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Report Issue'}
                  </Button>
                </div>
              </form>
            </CardContent>
          ) : (
            <CardContent>
              <Button onClick={() => setShowNewIssueForm(true)} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Report New Issue
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Open Issues */}
      {openIssues.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base">Active Issues ({openIssues.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openIssues.map(issue => (
              <div key={issue.id} className="border rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold">{issue.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getSeverityColor(issue.severity)}>
                      {issue.severity}
                    </Badge>
                    <Badge className={getStatusColor(issue.status)}>
                      {issue.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Manager Action Section */}
                {userRole === 'manager' && issue.status === 'open' && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledgeIssue(issue.id)}
                      >
                        Acknowledge Issue
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Manager Resolution Section */}
                {userRole === 'manager' && issue.status !== 'resolved' && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="block text-sm font-medium">Resolution Notes</label>
                    <Textarea
                      value={resolutionNotes[issue.id] || ''}
                      onChange={e => {
                        const updated = { ...resolutionNotes, [issue.id]: e.target.value }
                        setResolutionNotes(updated)
                      }}
                      placeholder="Provide resolution or next steps..."
                      className="min-h-16 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleResolveIssue(issue.id)}
                      disabled={!resolutionNotes[issue.id]?.trim()}
                    >
                      Mark as Resolved
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Resolved Issues */}
      {resolvedIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolved Issues ({resolvedIssues.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolvedIssues.map(issue => (
              <div
                key={issue.id}
                className="border rounded-lg p-4 space-y-2 bg-muted/50 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold line-through text-muted-foreground">
                      {issue.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 line-through">
                      {issue.description}
                    </p>
                  </div>
                  <Badge className={getStatusColor(issue.status)}>Resolved</Badge>
                </div>

                {issue.resolution_notes && (
                  <div className="bg-white rounded p-2 mt-2">
                    <p className="text-xs text-muted-foreground font-semibold">
                      Manager Resolution:
                    </p>
                    <p className="text-xs">{issue.resolution_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {issues.length === 0 && !showNewIssueForm && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6 text-center text-muted-foreground">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>No issues reported</p>
            {userRole === 'service_provider' && !isReportLocked && (
              <p className="text-sm mt-1">Report any challenges you encounter</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
