export type CourseHole = {
  holeNumber: number;
  par: 3 | 4 | 5;
  handicapIndex: number;
};

export type CourseRecord = {
  id: string;
  name: string;
  city: string;
  state: string;
  holes: CourseHole[];
};
