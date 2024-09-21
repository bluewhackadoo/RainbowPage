import pygame
import random
import numpy as np

# Initialize Pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 400
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Moon Patrol Clone")

# Clock for controlling the frame rate
clock = pygame.time.Clock()

# Fonts
font = pygame.font.SysFont(None, 24)
game_over_font = pygame.font.SysFont(None, 48)

# Colors
SKY_COLOR = (0, 0, 32)           # Dark blue/black sky
GROUND_COLOR = (205, 133, 63)    # Pinkish brown ground
VEHICLE_COLOR = (255, 255, 0)    # Yellow vehicle
BOULDER_COLOR = (139, 69, 19)    # Brown boulders
CRATER_COLOR = (105, 105, 105)   # Gray craters
PROJECTILE_COLOR = (255, 0, 0)   # Red projectiles

# Sound generation function
def generate_sound(frequency, duration, volume=0.5):
    sample_rate = 44100
    n_samples = int(sample_rate * duration)
    # Generate mono sound buffer
    buf = (np.sin(2 * np.pi * np.arange(n_samples) * frequency / sample_rate)).astype(np.float32)
    # Adjust volume and convert to 16-bit integers
    buf = (buf * volume * (2**15 - 1)).astype(np.int16)
    # Duplicate the mono channel to create stereo sound
    stereo_buf = np.column_stack((buf, buf))
    # Create a pygame Sound object
    sound = pygame.sndarray.make_sound(stereo_buf)
    return sound

# Sounds
jump_sound = generate_sound(440, 0.2)
crash_sound = generate_sound(60, 0.5)
shoot_sound = generate_sound(880, 0.1)
life_lost_sound = generate_sound(220, 0.5)
level_up_sound = generate_sound(550, 0.5)
game_over_sound = generate_sound(110, 1.0)

def main_game():
    # Vehicle properties
    vehicle_width = 40
    vehicle_height = 20
    vehicle_x = 100
    vehicle_y = HEIGHT - 60
    vehicle_vel_y = 0
    is_jumping = False

    # Obstacle properties
    obstacles = []
    OBSTACLE_EVENT = pygame.USEREVENT + 1
    obstacle_interval = 1500
    pygame.time.set_timer(OBSTACLE_EVENT, obstacle_interval)

    # Projectile properties
    projectiles = []
    PROJECTILE_SPEED = 10
    shoot_cooldown = 0

    # Game properties
    lives = 3
    score = 0
    distance = 0
    level = 1
    level_duration = 2000  # Distance to complete level
    level_progress = 0

    # Game loop
    running = True
    scroll_speed = 5
    ground_y = HEIGHT - 40
    terrain_x = 0

    while running:
        clock.tick(60)  # 60 FPS

        # Event handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                exit()

            if event.type == OBSTACLE_EVENT:
                obstacle_type = random.choice(['boulder', 'crater'])
                if obstacle_type == 'boulder':
                    if random.random() < 0.2:  # 20% chance to create a double-sized boulder
                        obstacles.append({'type': 'boulder', 'x': WIDTH, 'y': ground_y - 40, 'width': 40, 'height': 40, 'hits': 2})
                    else:
                        obstacles.append({'type': 'boulder', 'x': WIDTH, 'y': ground_y - 20, 'width': 20, 'height': 20, 'hits': 1})
                else:
                    # Variable size craters
                    crater_width = random.randint(40, 80)
                    crater_depth = random.randint(20, 40)
                    obstacles.append({'type': 'crater', 'x': WIDTH, 'y': ground_y, 'width': crater_width, 'height': crater_depth})

        # Key handling
        keys = pygame.key.get_pressed()
        if keys[pygame.K_SPACE] and not is_jumping:
            vehicle_vel_y = -15
            is_jumping = True
            jump_sound.play()
        if keys[pygame.K_f] and shoot_cooldown == 0:
            # Create a new projectile
            projectile = {'x': vehicle_x + vehicle_width, 'y': vehicle_y + vehicle_height // 2, 'width': 10, 'height': 4}
            projectiles.append(projectile)
            shoot_sound.play()
            shoot_cooldown = 15  # Cooldown frames to prevent spamming

        if shoot_cooldown > 0:
            shoot_cooldown -= 1

        # Update vehicle position
        vehicle_vel_y += 1  # Gravity
        vehicle_y += vehicle_vel_y
        if vehicle_y >= HEIGHT - 60:
            vehicle_y = HEIGHT - 60
            vehicle_vel_y = 0
            is_jumping = False

        # Update obstacle positions
        for obstacle in obstacles:
            obstacle['x'] -= scroll_speed

        # Remove off-screen obstacles
        obstacles = [obs for obs in obstacles if obs['x'] + obs['width'] > 0]

        # Update projectile positions
        for projectile in projectiles:
            projectile['x'] += PROJECTILE_SPEED

        # Remove off-screen projectiles
        projectiles = [proj for proj in projectiles if proj['x'] < WIDTH]

        # Collision detection between projectiles and boulders
        for projectile in projectiles[:]:
            projectile_rect = pygame.Rect(projectile['x'], projectile['y'], projectile['width'], projectile['height'])
            for obstacle in obstacles[:]:
                if obstacle['type'] == 'boulder':
                    obstacle_rect = pygame.Rect(obstacle['x'], obstacle['y'], obstacle['width'], obstacle['height'])
                    if projectile_rect.colliderect(obstacle_rect):
                        # Reduce hits or remove the boulder
                        obstacle['hits'] -= 1
                        projectiles.remove(projectile)
                        if obstacle['hits'] <= 0:
                            obstacles.remove(obstacle)
                            score += 50  # Points for destroying a boulder
                        break  # Break out of the inner loop

        # Collision detection between vehicle and obstacles
        vehicle_rect = pygame.Rect(vehicle_x, vehicle_y, vehicle_width, vehicle_height)
        collision = False
        for obstacle in obstacles[:]:
            if obstacle['type'] == 'crater':
                # Check if vehicle is over the crater
                if (vehicle_x + vehicle_width > obstacle['x'] and
                    vehicle_x < obstacle['x'] + obstacle['width']):
                    # Vehicle is over the crater
                    if vehicle_y + vehicle_height >= ground_y:
                        # Vehicle is at ground level, so it falls into the crater
                        collision = True
                        break  # Exit the loop after collision
            else:
                obstacle_rect = pygame.Rect(obstacle['x'], obstacle['y'], obstacle['width'], obstacle['height'])
                if vehicle_rect.colliderect(obstacle_rect):
                    collision = True
                    break  # Exit the loop after collision

        if collision:
            crash_sound.play()
            lives -= 1
            life_lost_sound.play()
            # Reset vehicle position
            vehicle_y = HEIGHT - 60
            vehicle_vel_y = 0
            is_jumping = False
            # Clear obstacles and projectiles
            obstacles.clear()
            projectiles.clear()
            if lives == 0:
                running = False  # End the game when lives are depleted

        # Update score and distance
        distance += scroll_speed
        if distance % 100 == 0:
            score += 1  # Increment score over time

        # Level progression
        level_progress += scroll_speed
        if level_progress >= level_duration:
            level += 1
            level_progress = 0
            level_up_sound.play()
            # Increase difficulty by increasing scroll speed and obstacle frequency
            scroll_speed += 1
            obstacle_interval = max(500, 1500 - (level * 100))
            pygame.time.set_timer(OBSTACLE_EVENT, obstacle_interval)

        # Drawing
        screen.fill(SKY_COLOR)

        # Draw ground
        pygame.draw.rect(screen, GROUND_COLOR, (0, ground_y, WIDTH, HEIGHT - ground_y))

        # Draw obstacles
        for obstacle in obstacles:
            if obstacle['type'] == 'boulder':
                pygame.draw.rect(screen, BOULDER_COLOR, (obstacle['x'], obstacle['y'], obstacle['width'], obstacle['height']))
            elif obstacle['type'] == 'crater':
                # Draw the crater as an inverted triangle
                crater_x = obstacle['x']
                crater_y = ground_y
                crater_width = obstacle['width']
                crater_depth = obstacle['height']
                points = [
                    (crater_x, crater_y),  # Left top
                    (crater_x + crater_width / 2, crater_y + crater_depth),  # Bottom center
                    (crater_x + crater_width, crater_y)  # Right top
                ]
                pygame.draw.polygon(screen, SKY_COLOR, points)

        # Draw vehicle
        pygame.draw.rect(screen, VEHICLE_COLOR, (vehicle_x, vehicle_y, vehicle_width, vehicle_height))

        # Draw projectiles
        for projectile in projectiles:
            pygame.draw.rect(screen, PROJECTILE_COLOR, (projectile['x'], projectile['y'], projectile['width'], projectile['height']))

        # Draw HUD (Score, Lives, Level)
        score_text = font.render(f"Score: {score}", True, (255, 255, 255))
        lives_text = font.render(f"Lives: {lives}", True, (255, 255, 255))
        level_text = font.render(f"Level: {level}", True, (255, 255, 255))
        screen.blit(score_text, (10, 10))
        screen.blit(lives_text, (10, 30))
        screen.blit(level_text, (10, 50))

        # Update the display
        pygame.display.flip()

    # Play game over sound
    game_over_sound.play()

    return score  # Return the final score when the game ends

def game_over_screen(final_score):
    # Display Game Over Screen
    game_over_text = game_over_font.render("GAME OVER", True, (255, 0, 0))
    final_score_text = font.render(f"Final Score: {final_score}", True, (255, 255, 255))
    restart_text = font.render("Press 'R' to Restart or 'Esc' to Quit", True, (255, 255, 255))

    game_over_running = True
    while game_over_running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                game_over_running = False
                pygame.quit()
                exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    game_over_running = False
                    pygame.quit()
                    exit()
                if event.key == pygame.K_r:
                    game_over_running = False  # Exit the game over screen to restart the game

        screen.fill((0, 0, 0))
        screen.blit(game_over_text, (WIDTH // 2 - game_over_text.get_width() // 2, HEIGHT // 2 - 80))
        screen.blit(final_score_text, (WIDTH // 2 - final_score_text.get_width() // 2, HEIGHT // 2 - 20))
        screen.blit(restart_text, (WIDTH // 2 - restart_text.get_width() // 2, HEIGHT // 2 + 20))
        pygame.display.flip()

# Main loop to handle restarting the game
while True:
    final_score = main_game()
    game_over_screen(final_score)
