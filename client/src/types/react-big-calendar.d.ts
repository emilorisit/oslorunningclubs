declare module 'react-big-calendar' {
  export * from 'react-big-calendar/lib/localizers/moment';
  
  import { ComponentType } from 'react';

  export interface NavigateAction {
    action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE';
    date?: Date;
  }

  export interface View {
    name: string;
    title: string;
  }

  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: 'select' | 'click' | 'doubleClick';
  }

  export interface Event {
    id?: string | number;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
  }

  export interface CalendarProps<T = Event> {
    localizer: any;
    events: T[];
    views?: string[] | { [viewName: string]: boolean };
    view?: string;
    onView?: (view: string) => void;
    date?: Date;
    onNavigate?: (date: Date, view?: string, action?: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => void;
    onSelectEvent?: (event: T) => void;
    eventPropGetter?: (event: T, start: Date, end: Date, isSelected: boolean) => { className?: string; style?: React.CSSProperties };
    dayPropGetter?: (date: Date) => { className?: string; style?: React.CSSProperties };
    selectable?: boolean;
    toolbar?: boolean;
    culture?: string;
    components?: any;
    style?: React.CSSProperties;
    className?: string;
    startAccessor?: string | ((event: T) => Date);
    endAccessor?: string | ((event: T) => Date);
    titleAccessor?: string | ((event: T) => string);
    formats?: {
      dayFormat?: string;
      weekdayFormat?: string;
      monthHeaderFormat?: string;
      dayRangeHeaderFormat?: any;
      dayHeaderFormat?: any;
      agendaHeaderFormat?: any;
      selectRangeFormat?: any;
      agendaDateFormat?: any;
      agendaTimeFormat?: any;
      agendaTimeRangeFormat?: any;
      timeGutterFormat?: any;
    };
    min?: Date;
    max?: Date;
  }

  export class Calendar<T = Event> extends React.Component<CalendarProps<T>> {
    static Views: {
      MONTH: string;
      WEEK: string;
      WORK_WEEK: string;
      DAY: string;
      AGENDA: string;
    };
  }

  export default Calendar;
}