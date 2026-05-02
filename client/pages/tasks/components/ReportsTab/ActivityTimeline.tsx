import React from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  MessageSquare,
  Loader2,
} from 'lucide-react'

interface ActivityTimelineProps {
  reportId: string
}

export default function ActivityTimeline({ reportId }: ActivityTimelineProps) {
  // Fetch activity log
  const activityQuery = useQuery({
    queryKey: ['report-activity', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_activity_log')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching activity:', error)
        return []
      }

      return data || []
    },
  })

  const activities = activityQuery.data || []

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Clock className="h-4 w-4" />
      case 'submitted':
        return <Upload className="h-4 w-4" />
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'checklist_checked':
        return <CheckCircle2 className="h-4 w-4" />
      case 'evidence_added':
        return <Upload className="h-4 w-4" />
      case 'issue_raised':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      case 'issue_resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'updated':
        return <FileText className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getActivityLabel = (action: string, details?: Record<string, any>) => {
    switch (action) {
      case 'created':
        return 'Report created'
      case 'submitted':
        return 'Report submitted for review'
      case 'approved':
        return 'Report approved'
      case 'rejected':
        return 'Report sent back for revision'
      case 'checklist_checked':
        return `Checklist item marked: "${details?.checklist_item || 'Unknown'}"`
      case 'evidence_added':
        return `Evidence uploaded: ${details?.filename || 'Unknown'}`
      case 'issue_raised':
        return `Issue raised: "${details?.issue_title || 'Unknown'}"`
      case 'issue_resolved':
        return 'Issue resolved'
      case 'updated':
        return 'Report updated'
      default:
        return action.replace(/_/g, ' ')
    }
  }

  const getActivityColor = (action: string) => {
    if (action === 'approved') return 'text-green-600'
    if (action === 'rejected') return 'text-red-600'
    if (action.includes('issue')) return 'text-amber-600'
    if (action === 'submitted') return 'text-blue-600'
    return 'text-gray-600'
  }

  if (activityQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No activity yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-4">
              {/* Timeline Line */}
              <div className="relative flex flex-col items-center">
                <div className={`${getActivityColor(activity.action)}`}>
                  {getActivityIcon(activity.action)}
                </div>
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-12 bg-muted mt-2" />
                )}
              </div>

              {/* Activity Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {getActivityLabel(activity.action, activity.details)}
                  </p>
                  <span className="text-xs text-muted-foreground capitalize">
                    {activity.actor_role}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(activity.created_at).toLocaleString()}
                </p>

                {/* Additional Details */}
                {activity.details && (
                  <div className="mt-2 bg-muted/50 rounded p-2">
                    {activity.details.notes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Notes:</span> {activity.details.notes}
                      </p>
                    )}
                    {activity.details.reason && (
                      <p className="text-xs text-red-600">
                        <span className="font-semibold">Reason:</span> {activity.details.reason}
                      </p>
                    )}
                    {activity.details.resolution_notes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Resolution:</span>{' '}
                        {activity.details.resolution_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
