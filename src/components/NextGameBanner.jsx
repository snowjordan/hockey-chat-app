import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { formatGameDate, formatGameTime } from '../utils/scheduleHelpers.js';

export default function NextGameBanner({ games, selectedIndex, gameContext, onSelect }) {
    if (!gameContext || games.length === 0) return null;

    return (
        <section className="app-bar-ribbon next-game-banner" aria-label="Upcoming games">
            <div className="next-game-banner-summary" aria-live="polite" aria-atomic="true">
                <strong className="next-game-banner-matchup" title={gameContext.matchup}>{gameContext.matchup}</strong>
                <div className="next-game-banner-details">
                    <span>{gameContext.date}</span>
                    <span>{gameContext.time}</span>
                    <span title={gameContext.rink}>{gameContext.rink}</span>
                </div>
            </div>
            <div className="next-game-banner-controls">
                <label className="next-game-banner-picker">
                    <select aria-label="Jump to game" title="Jump to game" value={String(selectedIndex)} onChange={(event) => onSelect(Number(event.target.value))}
                        disabled={games.length === 1}>
                        {games.map((game, index) => (
                            <option key={game.id} value={String(index)}>
                                {formatGameDate(game.game_date, { includeYear: true })} at {formatGameTime(game.start_time)} - {game.home_team_name ?? 'TBD'} vs {game.away_team_name ?? 'TBD'}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="next-game-banner-navigation" role="group" aria-label="Switch game">
                    <button type="button" disabled={selectedIndex === 0} onClick={() => onSelect(selectedIndex - 1)} aria-label="Previous game" title="Previous game">
                        <IconChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button type="button" disabled={selectedIndex >= games.length - 1} onClick={() => onSelect(selectedIndex + 1)} aria-label="Next game" title="Next game">
                        <IconChevronRight size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </section>
    );
}
