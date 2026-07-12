import type { TPDocument } from '../types';
import { buildECPattern } from './ec-shared';

/**
 * Pattern: Study vs enjoy (Evaporating Cloud).
 *
 * The "classic dilemma of a college student" worked in the *TOC Handbook*
 * (Ch. 38, "TOC for Personal Productivity/Dilemmas", Cox & Schleier),
 * abstracted: a rewarding time at college needs both doing well academically
 * and enjoying the wider experience, and time spent on one is time not spent on
 * the other. A recognizable everyday work-vs-play cloud that reads cleanly with
 * necessity logic ("in order to have a successful time at college, I must do
 * well academically"). Assumptions follow the source's tabled set, paraphrased.
 * Node text is original.
 */
export const buildPatternECStudyVsEnjoy = (): TPDocument =>
  buildECPattern({
    title: 'Study vs enjoy (student cloud)',
    objective: 'Have a successful time at college',
    need1: 'Do well academically',
    need2: 'Enjoy the wider college experience',
    want1: 'Spend my time studying',
    want2: 'Spend my time on everything else college offers',
    assumptions: [
      {
        arrow: 'b-a',
        text: 'Doing well academically lays the foundation for what comes after college.',
      },
      {
        arrow: 'c-a',
        text: 'The social side — friends, activities, a last stretch before full-time life — is part of what makes college worthwhile.',
      },
      { arrow: 'd-b', text: 'There are no shortcuts to learning; it takes hours.' },
      { arrow: 'dPrime-c', text: 'All work and no play makes for a dull, brittle life.' },
    ],
  });
