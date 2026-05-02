import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { UserProfile, TaskReport, Task } from '@/lib/supabase'
import ServiceProviderReportsView from './ServiceProviderReportsView'
import ManagerReportsView from './ManagerReportsView'
import { useQuery } from '@tanstack/react-query'

interface ReportsTabProps {
  currentUser: any
  currentUserProfile: UserProfile | null
  userRole: 'manager' | 'service_provider' | 'guest'
}

export default function ReportsTab({
  currentUser,
  currentUserProfile,
  userRole,
}: ReportsTabProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Service provider gets their assigned tasks with active reports
  const serviceProviderReportsQuery = useQuery({
    queryKey: ['service-provider-reports', currentUserProfile?.id, refreshTrigger],
    queryFn: async () => {
      if (!currentUserProfile || userRole !== 'service_provider') return []

      const { data, error } = await supabase
        .from('task_reports')
        .select(
          `
          *,
          tasks:task_id (
            id, title, description, priority, status, due_date,
            assigned_to, category, budget, created_by
          )
        `
        )
        .eq('provider_id', currentUserProfile.id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching service provider reports:', error)
        return []
      }

      return data || []
    },
    enabled: userRole === 'service_provider' && !!currentUserProfile,
  })

  // Manager gets reports for tasks they created
  const managerReportsQuery = useQuery({
    queryKey: ['manager-reports', currentUser?.id, refreshTrigger],
    queryFn: async () => {
      if (!currentUser || userRole !== 'manager') return []

      const { data, error } = await supabase
        .from('task_reports')
        .select(
          `
          *,
          provider:provider_id (
            id, first_name, last_name, service_type
          ),
          tasks:task_id (
            id, title, description, priority, status, due_date,
            assigned_to, category, budget, created_by
          )
        `
        )
        .eq('tasks.created_by', currentUser.id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Error fetching manager reports:', error)
        return []
      }

      return data || []
    },
    enabled: userRole === 'manager' && !!currentUser,
  })

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  if (userRole === 'service_provider') {
    return (
      <ServiceProviderReportsView
        reports={serviceProviderReportsQuery.data || []}
        currentUserProfile={currentUserProfile}
        currentUser={currentUser}
        isLoading={serviceProviderReportsQuery.isLoading}
        onRefresh={handleRefresh}
      />
    )
  }

  if (userRole === 'manager') {
    return (
      <ManagerReportsView
        reports={managerReportsQuery.data || []}
        currentUser={currentUser}
        isLoading={managerReportsQuery.isLoading}
        onRefresh={handleRefresh}
      />
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">
        You must be a manager or service provider to view reports.
      </p>
    </div>
  )
}
