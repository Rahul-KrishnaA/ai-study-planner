import type { StudyPlan, AppSettings } from '../types';

let scheduledTimers: ReturnType<typeof setTimeout>[] = [];

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function showNotification(title: string, body: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
  } catch {
    // Some browsers block notifications in certain contexts
  }
}

/** Clears all pending notification timers */
export function clearScheduledNotifications() {
  scheduledTimers.forEach(clearTimeout);
  scheduledTimers = [];
}

/** Schedules browser notifications for all of today's sessions */
export function scheduleSessionNotifications(plan: StudyPlan, settings: AppSettings) {
  clearScheduledNotifications();
  if (!settings.remindersEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const todaySchedule = plan.weeklySchedule.find((d) => d.day === todayName);
  if (!todaySchedule) return;

  const now = new Date();

  todaySchedule.sessions.forEach((session) => {
    const [h, m] = session.startTime.split(':').map(Number);
    const sessionMs = new Date(now.toDateString()).getTime() + h * 3600000 + m * 60000;
    const reminderMs = sessionMs - settings.reminderMinutesBefore * 60000;
    const msUntilReminder = reminderMs - now.getTime();

    if (msUntilReminder > 0) {
      const timer = setTimeout(() => {
        showNotification(
          `Study session starting soon`,
          `${session.subject} — ${session.chapter} at ${session.startTime}`,
          `session-${session.id}`
        );
      }, msUntilReminder);
      scheduledTimers.push(timer);
    }

    // Also notify at session start
    const msUntilStart = sessionMs - now.getTime();
    if (msUntilStart > 0) {
      const timer = setTimeout(() => {
        showNotification(
          `Time to study: ${session.subject}`,
          `${session.chapter} — ${session.startTime} to ${session.endTime}`,
          `session-start-${session.id}`
        );
      }, msUntilStart);
      scheduledTimers.push(timer);
    }
  });
}

/** Notify that sessions were rescheduled */
export function notifyRescheduled(count: number) {
  showNotification(
    `${count} session${count > 1 ? 's' : ''} rescheduled`,
    'Missed sessions have been moved to upcoming slots in your timetable.',
    'reschedule-notice'
  );
}

/** Exam countdown reminder */
export function notifyExamCountdown(subject: string, daysLeft: number) {
  showNotification(
    `${subject} exam in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    'Make sure your study sessions are on track.',
    `exam-countdown-${subject}`
  );
}
