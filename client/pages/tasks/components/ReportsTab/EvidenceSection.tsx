import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import { Upload, Camera, Image as ImageIcon, Video, File, X, Loader2 } from 'lucide-react'
import { useFileUpload } from '@/hooks/useFileUpload'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EvidenceSectionProps {
  reportId: string
  taskId: string
  userRole: 'manager' | 'service_provider'
  currentUser: any
  isReportLocked: boolean
  onEvidenceAdded?: () => void
}

export default function EvidenceSection({
  reportId,
  taskId,
  userRole,
  currentUser,
  isReportLocked,
  onEvidenceAdded,
}: EvidenceSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const { uploadFile } = useFileUpload()

  // Fetch evidence requirements
  const requirementsQuery = useQuery({
    queryKey: ['evidence-requirements', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_evidence_requirements')
        .select('*')
        .eq('task_id', taskId)

      if (error) {
        console.error('Error fetching evidence requirements:', error)
        return []
      }

      return data || []
    },
  })

  // Fetch uploaded evidence
  const evidenceQuery = useQuery({
    queryKey: ['report-evidence', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_evidence')
        .select(
          `
          *,
          attachments:attachment_id (
            id, filename, original_name, file_size, mime_type, b2_url, file_type
          )
        `
        )
        .eq('report_id', reportId)

      if (error) {
        console.error('Error fetching evidence:', error)
        return []
      }

      return data || []
    },
  })

  const requirements = requirementsQuery.data || []
  const uploadedEvidence = evidenceQuery.data || []

  const getEvidenceCount = (type: string) => {
    return uploadedEvidence.filter(e => e.evidence_type === type).length
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || isReportLocked || userRole !== 'service_provider')
      return

    setIsUploading(true)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // Determine file type
        let evidenceType: 'image' | 'video' | 'file' = 'file'
        if (file.type.startsWith('image/')) {
          evidenceType = 'image'
        } else if (file.type.startsWith('video/')) {
          evidenceType = 'video'
        }

        // Upload file
        const attachment = await uploadFile(file, currentUser.id)

        if (attachment) {
          // Link to report
          await supabase.from('report_evidence').insert({
            report_id: reportId,
            attachment_id: attachment.id,
            evidence_type: evidenceType,
            description: `${evidenceType} uploaded on ${new Date().toLocaleDateString()}`,
          })

          // Log activity
          await supabase.from('report_activity_log').insert({
            report_id: reportId,
            action: 'evidence_added',
            actor_id: currentUser.id,
            actor_role: 'service_provider',
            details: {
              evidence_type: evidenceType,
              filename: file.name,
            },
          })
        }
      }

      evidenceQuery.refetch()
      onEvidenceAdded?.()
    } catch (error) {
      console.error('Error uploading evidence:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isReportLocked || userRole !== 'service_provider') return
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const removeEvidence = async (evidenceId: string) => {
    if (isReportLocked || userRole !== 'service_provider') return

    try {
      await supabase.from('report_evidence').delete().eq('id', evidenceId)

      evidenceQuery.refetch()
    } catch (error) {
      console.error('Error removing evidence:', error)
    }
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Evidence Requirements */}
      {requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence Requirements</CardTitle>
            <CardDescription>
              {userRole === 'service_provider'
                ? 'Upload evidence to demonstrate work completion'
                : 'Review uploaded evidence for task completion'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requirements.map(req => (
                <div key={req.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div>
                    <p className="font-medium text-sm">{req.evidence_type}</p>
                    {req.description && (
                      <p className="text-xs text-muted-foreground">{req.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{getEvidenceCount(req.evidence_type)}</div>
                    {req.is_required && (
                      <span className="text-xs text-red-600">Required</span>
                    )}
                    {req.max_files && (
                      <span className="text-xs text-muted-foreground">
                        Max: {req.max_files}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      {userRole === 'service_provider' && !isReportLocked && (
        <Card
          className={`transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Drag and Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Drag and drop files here</p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (images, videos, documents)
                </p>
              </div>

              {/* File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={e => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={isUploading}
              />

              {/* Camera Input */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => handleFileUpload(e.target.files)}
                className="hidden"
              />

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>

              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Evidence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Uploaded Evidence ({uploadedEvidence.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uploadedEvidence.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No evidence uploaded yet
            </p>
          ) : (
            <div className="space-y-2">
              {uploadedEvidence.map(evidence => (
                <div
                  key={evidence.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getIconForType(evidence.evidence_type)}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {evidence.attachments?.original_name || 'Unknown file'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {evidence.evidence_type} •{' '}
                        {(evidence.attachments?.file_size || 0) > 1024
                          ? `${((evidence.attachments?.file_size || 0) / 1024).toFixed(1)} KB`
                          : `${evidence.attachments?.file_size || 0} B`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {evidence.attachments?.b2_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={evidence.attachments.b2_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      </Button>
                    )}

                    {userRole === 'service_provider' && !isReportLocked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEvidence(evidence.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
