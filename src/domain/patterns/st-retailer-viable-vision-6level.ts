import type { TPDocument } from '../types';
import { buildSTFacetDoc } from './st-shared';

/**
 * Pattern: Retailer Viable Vision — 6-level (Strategy & Tactics Tree, facet model).
 *
 * The deep form of Ferguson's retail Viable Vision (Handbook Ch. 34; Ch. 18),
 * abstracted with original wording. Where the shipped 3-level version sketches the
 * arc, this one decomposes the pull-replenishment transformation down through six
 * layers — data, buffers, cadence, pilot, rollout, and the review that sustains
 * it — so it shows the fuller shape: a spine of full-facet intermediate steps
 * (necessary assumption up AND sufficiency assumption down), each with a leaf
 * sibling. The apex omits the necessary assumption; every leaf omits sufficiency.
 */
export const buildPatternSTRetailerViableVision6Level = (): TPDocument =>
  buildSTFacetDoc('Retailer Viable Vision — 6-level S&T', {
    tactic: 'Make the shelf reliably available at low inventory across the existing stores',
    strategy: 'The retailer reaches its ambitious profit vision on its current stores and capital',
    parallel:
      'The constraint is availability-vs-inventory flow, not store count — fixing the flow beats opening more stores',
    sufficiency:
      'It needs the replenishment engine built AND the incentives that would fight it re-pointed — hence the two sub-steps',
    children: [
      {
        // L2 spine — build the engine.
        tactic: 'Stand up a central-pull replenishment engine feeding stores from real sales',
        strategy:
          'Stock is held centrally and pulled to each store from what actually sold, not from a forecast',
        necessary:
          'Forecast-pushed store stock is exactly what creates the stockout-and-overstock the vision must remove',
        parallel:
          'Central holding with pull beats bigger back-rooms — aggregating stock cuts the inventory the flow needs',
        sufficiency:
          'An engine needs both the daily consumption signal it runs on AND the cash to fund the one-time stock-transition hump — hence the two sub-steps',
        children: [
          {
            // L3 spine — the data the engine runs on.
            tactic: 'Feed the engine each store’s real sell-through daily, item by item',
            strategy:
              'Every replenishment decision is driven by yesterday’s actual demand, per store per item',
            necessary:
              'Without a clean daily consumption feed the engine is just another forecast wearing a new name',
            parallel:
              'A same-day sales feed beats weekly reports — the engine can only pull as fresh as the data it sees',
            sufficiency:
              'The signal is only useful once buffers turn it into order quantities AND it is kept honest against shrinkage and miscounts — hence the two sub-steps',
            children: [
              {
                // L4 spine — turn the signal into buffers.
                tactic: 'Set a dynamic buffer per store-item sized to its own demand variability',
                strategy: 'Each store-item holds just enough to cover its real variation, no more',
                necessary:
                  'One flat coverage rule over-stocks the steady items and under-stocks the erratic ones — the worst of both',
                parallel:
                  'Variability-sized buffers beat a blanket days-of-cover — they put the inventory only where surprise lives',
                sufficiency:
                  'Buffers only hold if they are replenished on the right cadence AND the managers using them trust the signal over their own gut — hence the two sub-steps',
                children: [
                  {
                    // L5 spine — cadence + pilot.
                    tactic:
                      'Replenish to buffer on a short fixed cadence and pilot it in one region',
                    strategy:
                      'One region runs on frequent buffer-driven replenishment with availability up and inventory down',
                    necessary:
                      'A weekly cadence lets buffers swing wide between orders, re-creating the stockouts the engine was meant to end',
                    parallel:
                      'Short-cycle replenishment in a single pilot region beats a slow chain-wide switch — it proves the cadence cheaply',
                    sufficiency:
                      'A tuned pilot is only worth it if it is then rolled out to every region AND kept tuned as demand shifts — hence the two sub-steps',
                    children: [
                      {
                        // L6 leaf — rollout.
                        tactic:
                          'Roll the proven engine out region by region on the tuned buffers and cadence',
                        strategy: 'Every region runs the same buffer-driven daily replenishment',
                        necessary:
                          'A partial rollout leaves the old push system fighting the new pull one at every seam between regions',
                        parallel:
                          'Region-by-region on proven settings beats a big-bang cutover — it keeps the risk bounded as it spreads',
                      },
                      {
                        // L6 leaf — the sustaining review.
                        tactic:
                          'Run a monthly buffer-health review that re-sizes buffers as demand shifts',
                        strategy:
                          'Buffers stay right-sized as seasons and assortments change, so the gains hold',
                        necessary:
                          'Buffers set once and left alone drift out of tune as demand moves, and the availability gains quietly erode',
                        parallel:
                          'A standing review beats one-off tuning — a Viable Vision is sustained by maintenance, not a single project',
                      },
                    ],
                  },
                  {
                    // L5 leaf sibling — the people side of cadence.
                    tactic:
                      'Train regional managers to act on buffer-status colour, not on gut re-orders',
                    strategy:
                      'Replenishment decisions follow the buffer signal, not a manager’s hunch',
                    necessary:
                      'If managers keep placing gut orders on top of the engine, they re-introduce the very swings it removes',
                    parallel:
                      'Teaching the signal beats policing overrides — people follow a status they trust and understand',
                  },
                ],
              },
              {
                // L4 leaf sibling — data integrity.
                tactic:
                  'Reconcile point-of-sale to on-hand nightly so the consumption feed stays honest',
                strategy: 'The demand signal reflects real sales, not shrinkage or miscounts',
                necessary:
                  'A feed corrupted by phantom inventory pulls the wrong quantities and quietly poisons every buffer downstream',
                parallel:
                  'A nightly reconciliation beats a quarterly stock-take — the engine needs trustworthy data continuously, not once a season',
              },
            ],
          },
          {
            // L3 leaf sibling — funding the transition.
            tactic:
              'Fund the one-time inventory hump of moving stock from stores to the central buffer',
            strategy: 'The transition to central holding is capitalised without a cash crunch',
            necessary:
              'The switch briefly needs stock in both places at once, and an unfunded hump stalls the rollout mid-flight',
            parallel:
              'Planning the transition cash beats discovering it — the hump is temporary and shrinks as store inventory drains',
          },
        ],
      },
      {
        // L2 leaf sibling — incentives.
        tactic:
          'Re-point store and regional bonuses onto availability and inventory turns, off local sell-in volume',
        strategy:
          'Every store and regional team is measured on the flow the whole engine depends on',
        necessary:
          'A six-layer pull engine is still beaten on the floor if the bonus keeps paying people to over-order locally',
        parallel:
          'Changing what the bonus rewards beats issuing a compliance mandate — people optimise the number they are paid on',
      },
    ],
  });
