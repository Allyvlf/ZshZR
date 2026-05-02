import React, { useState } from 'react'
import { supabase, TaskChecklist } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

interface ChecklistSectionProps {
  reportId: string
  taskId: string
  userRole: 'manager' | 'service_provider'
  currentUser: any
  isReportLocked: boolean
  onActivityLogged?: () => void
}

export default function ChecklistSection({
  reportId,
  taskId,
  userRole,
  currentUser,
  isReportLocked,
  onActivityLogged,
}: ChecklistSectionProps) {
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({})
  const [isUpdating, setIsUpdating] = useState(false)

  // Fetch checklist items
  const checklistQuery = useQuery({
    queryKey: ['task-checklist', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_checklists')
        .select('*')
        .eq('task_id', taskId)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Error fetching checklist:', error)
        return []
      }

      return data || []
    },
  })

  // Fetch report checklist progress
  const reportChecklistQuery = useQuery({
    queryKey: ['report-checklist', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_checklist_items')
        .select('*')
        .eq('report_id', reportId)

      if (error) {
        console.error('Error fetching report checklist:', error)
        return []
      }

      return data || []
    },
  })

  const checklists = checklistQuery.data || []
  const reportChecklists = reportChecklistQuery.data || []

  const getChecklistItemStatus = (checklistId: string) => {
    return reportChecklists.find(rc => rc.checklist_item_id === checklistId)
  }

  const handleToggleItem = async (checklistId: string, currentChecked: boolean) => {
    if (isReportLocked || userRole !== 'service_provider') return

    setIsUpdating(true)

    try {
      const existingItem = getChecklistItemStatus(checklistId)

      if (existingItem) {
        // Update existing
        await supabase
          .from('report_checklist_items')
          .update({
            is_checked: !currentChecked,
            checked_at: !currentChecked ? new Date().toISOString() : null,
            notes: checklistNotes[checklistId] || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingItem.id)
      } else {
        // Create new
        await supabase.from('report_checklist_items').insert({
          report_id: reportId,
          checklist_item_id: checklistId,
          is_checked: !currentChecked,
          checked_at: !currentChecked ? new Date().toISOString() : null,
          notes: checklistNotes[checklistId] || null,
        })
      }

      // Log activity
      const checklistItem = checklists.find(c => c.id === checklistId)
      await supabase.from('report_activity_log').insert({
        report_id: reportId,
        action: 'checklist_checked',
        actor_id: currentUser.id,
        actor_role: 'service_provider',
        details: {
          checklist_item: checklistItem?.title,
          checked: !currentChecked,
        },
      })

      reportChecklistQuery.refetch()
      onActivityLogged?.()
    } catch (error) {
      console.error('Error updating checklist item:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (checklistQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (checklists.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>No checklist items for this task</p>
          <p className="text-sm mt-1">The task manager did not add a checklist</p>
        </CardContent>
      </Card>
    )
  }

  const completedCount = reportChecklists.filter(rc => rc.is_checked).length
  const totalCount = checklists.length
  const completionPercentage = Math.round((completedCount / totalCount) * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Task Checklist</CardTitle>
            <CardDescription>
              {completedCount} of {totalCount} items completed ({completionPercentage}%)
            </CardDescription>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {checklists.map(checklist => {
          const reportItem = getChecklistItemStatus(checklist.id)
          const isChecked = reportItem?.is_checked || false

          return (
            <div
              key={checklist.id}
              className="border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`checklist-${checklist.id}`}
                  checked={isChecked}
                  onCheckedChange={() => handleToggleItem(checklist.id, isChecked)}
                  disabled={isReportLocked || userRole !== 'service_provider' || isUpdating}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor={`checklist-${checklist.id}`}
                    className={`font-medium cursor-pointer ${isChecked ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {checklist.title}
                  </label>
                  {checklist.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {checklist.description}
                    </p>
                  )}
                </div>
                {checklist.is_optional && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded text-muted-foreground">
                    Optional
                  </span>
                )}
              </div>

              {/* Notes section for each item */}
              {userRole === 'service_provider' && !isReportLocked && (
                <div className="ml-6">
                  <Textarea
                    placeholder="Add notes for this item (optional)..."
                    value={checklistNotes[checklist.id] || reportItem?.notes || ''}
                    onChange={e => {
                      const newNotes = { ...checklistNotes, [checklist.id]: e.target.value }
                      setChecklistNotes(newNotes)

                      // Auto-save notes
                      if (reportItem) {
                        supabase
                          .from('report_checklist_items')
                          .update({
                            notes: e.target.value || null,
                            updated_at: new Date().toISOString(),
                          })
                          .eq('id', reportItem.id)
                          .then(() => reportChecklistQuery.refetch())
                      }
                    }}
                    className="min-h-12 text-xs"
                  />
                </div>
              )}

              {reportItem?.notes && userRole === 'manager' && (
                <div className="ml-6 bg-blue-50 p-2 rounded text-sm">
                  <p className="text-xs text-muted-foreground font-semibold">Notes:</p>
                  <p className="text-muted-foreground">{reportItem.notes}</p>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
