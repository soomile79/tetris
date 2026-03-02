import pygame
import random

# --- Config ---
SCREEN_WIDTH, SCREEN_HEIGHT = 800, 600
GRID_SIZE = 30
COLS, ROWS = 10, 20
X_OFF = (SCREEN_WIDTH - COLS * GRID_SIZE) // 2
Y_OFF = (SCREEN_HEIGHT - ROWS * GRID_SIZE) // 2

PIECES = {
    'I': [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    'J': [[1,0,0],[1,1,1],[0,0,0]],
    'L': [[0,0,1],[1,1,1],[0,0,0]],
    'O': [[1,1],[1,1]],
    'S': [[0,1,1],[1,1,0],[0,0,0]],
    'T': [[0,1,0],[1,1,1],[0,0,0]],
    'Z': [[1,1,0],[0,1,1],[0,0,0]]
}
COLORS = {'I':(0,240,240),'J':(0,0,240),'L':(240,160,0),'O':(240,240,0),'S':(0,240,0),'T':(160,0,240),'Z':(240,0,0)}

class Tetris:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        self.clock = pygame.time.Clock()
        self.theme = 'modern' # Press 'T' to toggle
        self.bag = []
        self.reset()

    def reset(self):
        self.grid = [[None for _ in range(COLS)] for _ in range(ROWS)]
        self.score = 0
        self.game_over = False
        self.spawn_piece()

    def spawn_piece(self):
        if not self.bag:
            self.bag = list(PIECES.keys())
            random.shuffle(self.bag)
        ptype = self.bag.pop()
        self.active = {'type': ptype, 'shape': PIECES[ptype], 'x': 3, 'y': 0, 'color': COLORS[ptype]}
        if self.check_collision(self.active): self.game_over = True

    def check_collision(self, piece, dx=0, dy=0, shape=None):
        shape = shape or piece['shape']
        for y, row in enumerate(shape):
            for x, cell in enumerate(row):
                if cell:
                    nx, ny = piece['x'] + x + dx, piece['y'] + y + dy
                    if nx < 0 or nx >= COLS or ny >= ROWS or (ny >= 0 and self.grid[ny][nx]):
                        return True
        return False

    def rotate(self):
        new_s = [list(r) for r in zip(*self.active['shape'][::-1])]
        if not self.check_collision(self.active, shape=new_s): self.active['shape'] = new_s

    def draw(self):
        # Theme Logic
        bg = (10, 10, 15) if self.theme == 'modern' else (155, 188, 15)
        self.screen.fill(bg)
        
        # Ghost Piece Logic
        gy = self.active['y']
        while not self.check_collision(self.active, dy=gy-self.active['y']+1): gy += 1
        
        for y, row in enumerate(self.active['shape']):
            for x, cell in enumerate(row):
                if cell:
                    g_color = (40, 40, 40) if self.theme == 'modern' else (139, 172, 15)
                    pygame.draw.rect(self.screen, g_color, (X_OFF+(self.active['x']+x)*GRID_SIZE, Y_OFF+(gy+y)*GRID_SIZE, GRID_SIZE, GRID_SIZE))

        # Draw Grid
        for y, row in enumerate(self.grid):
            for x, cell in enumerate(row):
                if cell:
                    color = cell if self.theme == 'modern' else (48, 98, 48)
                    pygame.draw.rect(self.screen, color, (X_OFF+x*GRID_SIZE, Y_OFF+y*GRID_SIZE, GRID_SIZE, GRID_SIZE))
                    pygame.draw.rect(self.screen, bg, (X_OFF+x*GRID_SIZE, Y_OFF+y*GRID_SIZE, GRID_SIZE, GRID_SIZE), 1)

        pygame.display.flip()

    def run(self):
        timer = 0
        while not self.game_over:
            timer += self.clock.tick(60)
            if timer > 500:
                if self.check_collision(self.active, dy=1):
                    for y, row in enumerate(self.active['shape']):
                        for x, cell in enumerate(row):
                            if cell: self.grid[self.active['y']+y][self.active['x']+x] = self.active['color']
                    self.spawn_piece()
                else: self.active['y'] += 1
                timer = 0
            
            for event in pygame.event.get():
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_t: self.theme = 'classic' if self.theme == 'modern' else 'modern'
                    if event.key == pygame.K_LEFT and not self.check_collision(self.active, dx=-1): self.active['x'] -= 1
                    if event.key == pygame.K_RIGHT and not self.check_collision(self.active, dx=1): self.active['x'] += 1
                    if event.key == pygame.K_UP: self.rotate()
                    if event.key == pygame.K_DOWN and not self.check_collision(self.active, dy=1): self.active['y'] += 1
            self.draw()

if __name__ == "__main__": Tetris().run()