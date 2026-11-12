import { useQuery } from '@tanstack/react-query'
import { BookOpen, Hash, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SkeletonCard } from '@/components/shared/LoadingSpinner'
import ErrorState from '@/components/shared/ErrorState'
import { studentService } from '@/services/student.service'

export default function StudentSubjectsPage() {
  const { data: subjects, isLoading, isError, refetch } = useQuery({
    queryKey: ['student-subjects'],
    queryFn: studentService.getMySubjects,
  })

  if (isError) return <ErrorState message="Could not load your subjects." onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Subjects</h2>
        <p className="text-sm text-muted-foreground">
          {subjects?.length ?? 0} enrolled subject{subjects?.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : subjects?.map((subject) => (
              <Card key={subject._id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center" aria-hidden="true">
                      <BookOpen className="w-5 h-5 text-indigo-500" />
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
                    {typeof subject.assignedTeacher === 'object'
                      ? subject.assignedTeacher.name
                      : 'Assigned Teacher'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subject.department} · {subject.credits} credits
                  </div>
                  {subject.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{subject.description}</p>
                  )}
                </CardContent>
              </Card>
            ))
        }
        {!isLoading && !subjects?.length && (
          <p className="col-span-full text-center text-muted-foreground py-12">
            No subjects enrolled yet
          </p>
        )}
      </div>
    </div>
  )
}
