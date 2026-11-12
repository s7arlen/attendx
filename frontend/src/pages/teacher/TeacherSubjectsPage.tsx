import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Users, Hash, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState from '@/components/shared/ErrorState'
import { teacherService } from '@/services/teacher.service'

export default function TeacherSubjectsPage() {
  const navigate = useNavigate()
  const { data: subjects, isLoading, isError, refetch } = useQuery({
    queryKey: ['teacher-subjects'],
    queryFn: teacherService.getMySubjects,
  })

  if (isError) return <ErrorState message="Could not load your subjects." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Subjects</h2>
        <p className="text-sm text-muted-foreground">
          {subjects?.length ?? 0} subject{subjects?.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : subjects?.map((subject) => (
              <Card key={subject._id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden="true">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant={subject.isActive ? 'success' : 'secondary'}>
                      {subject.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{subject.subjectName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="w-3.5 h-3.5" aria-hidden="true" />
                    {subject.subjectCode}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    Year {subject.year} · Section {subject.section}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subject.department} · {subject.credits} credits
                  </div>
                  {subject.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{subject.description}</p>
                  )}
                  <Button
                    variant="outline" size="sm"
                    className="w-full mt-2 gap-1.5"
                    onClick={() => navigate(`/teacher/subjects/${subject._id}/attendance`)}
                  >
                    <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
                    View Attendance
                  </Button>
                </CardContent>
              </Card>
            ))
        }
        {!isLoading && !subjects?.length && (
          <p className="col-span-full text-center text-muted-foreground py-12">
            No subjects assigned yet
          </p>
        )}
      </div>
    </div>
  )
}
