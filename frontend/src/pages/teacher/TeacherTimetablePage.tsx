import { useQuery } from '@tanstack/react-query'
import { Clock, MapPin, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { teacherService } from '@/services/teacher.service'
import { Timetable } from '@/types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export default function TeacherTimetablePage() {
  const { data: timetable, isLoading } = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: teacherService.getMyTimetable,
  })

  const getSlotsByDay = (day: string) =>
    (timetable || []).filter((slot) => slot.day === day)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">My Timetable</h2>
        <p className="text-sm text-muted-foreground">Your weekly schedule</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map((day) => {
            const slots = getSlotsByDay(day)
            return (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {day}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No classes</p>
                  ) : (
                    slots.map((slot: Timetable) => (
                      <div
                        key={slot._id}
                        className="p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm font-medium">
                              {typeof slot.subjectId === 'object'
                                ? slot.subjectId.subjectName
                                : slot.subjectId}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {typeof slot.subjectId === 'object' ? slot.subjectId.subjectCode : ''}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {slot.startTime} – {slot.endTime}
                          </span>
                          {slot.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {slot.room}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
