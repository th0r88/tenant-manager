#!/bin/bash

# Tenant Management System - Simple Deployment Script
# This script helps with quick deployment across different environments

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}  Tenant Management System Deployment${NC}"
    echo -e "${BLUE}===========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get IP address
get_ip() {
    if command_exists ip; then
        ip route get 8.8.8.8 | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}'
    elif command_exists ifconfig; then
        ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1
    else
        echo "localhost"
    fi
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command_exists git; then
        print_error "Git is not installed. Please install git first."
        exit 1
    fi
    print_success "Git is installed"
}

# Setup environment
setup_environment() {
    print_info "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from .env.example"
        else
            print_warning ".env.example not found, creating basic .env file"
            cat > .env << EOF
NODE_ENV=production
PORT=5999
HOST=0.0.0.0
DATABASE_PATH=./data/tenant_manager.db
LOG_LEVEL=info
BACKUP_INTERVAL=24
HEALTH_CHECK_INTERVAL=1800000
EOF
        fi
    else
        print_success ".env file already exists"
    fi
    
    # Create necessary directories
    mkdir -p data backups logs alerts
    print_success "Created necessary directories"
}

# Traditional Node.js deployment
deploy_traditional() {
    print_info "Starting traditional Node.js deployment..."
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed."
        print_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    print_success "Node.js $(node --version) is installed"
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm ci --production
    print_success "Dependencies installed"
    
    # Setup environment
    setup_environment
    
    # Install PM2 if not present
    if ! command_exists pm2; then
        print_info "Installing PM2..."
        npm install -g pm2
        print_success "PM2 installed"
    fi
    
    # Start application
    print_info "Starting application with PM2..."
    pm2 start src/backend/server.js --name tenant-manager
    pm2 save
    print_success "Application started with PM2"
    
    # Display access information
    IP=$(get_ip)
    echo
    print_success "Deployment completed successfully!"
    print_info "Access your application at: http://$IP:5999"
    print_info "Manage with: pm2 status, pm2 logs tenant-manager, pm2 restart tenant-manager"
}

# Docker deployment
deploy_docker() {
    print_info "Starting Docker deployment..."
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed."
        print_info "Please install Docker from https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"
    
    # Check Docker Compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed."
        print_info "Please install Docker Compose from https://docs.docker.com/compose/install/"
        exit 1
    fi
    print_success "Docker Compose is installed"
    
    # Setup environment
    setup_environment
    
    # Choose compose file based on environment
    COMPOSE_FILE="docker-compose.yml"
    if [ "$1" = "homelab" ]; then
        COMPOSE_FILE="docker-compose.homelab.yml"
        print_info "Using homelab configuration"
    fi
    
    # Start services
    print_info "Starting services with Docker Compose..."
    docker-compose -f "$COMPOSE_FILE" up -d
    print_success "Services started"
    
    # Wait for health check
    print_info "Waiting for application to be ready..."
    sleep 10
    
    # Check if application is running
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        print_success "Application is running"
    else
        print_error "Application failed to start"
        print_info "Check logs with: docker-compose -f $COMPOSE_FILE logs"
        exit 1
    fi
    
    # Display access information
    IP=$(get_ip)
    echo
    print_success "Deployment completed successfully!"
    print_info "Access your application at: http://$IP:5999"
    print_info "Manage with: docker-compose -f $COMPOSE_FILE logs, docker-compose -f $COMPOSE_FILE restart"
}

# Development deployment
deploy_development() {
    print_info "Starting development deployment..."
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed."
        print_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    print_success "Node.js $(node --version) is installed"
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
    
    # Setup environment
    setup_environment
    
    # Update .env for development
    sed -i.bak 's/NODE_ENV=production/NODE_ENV=development/' .env
    sed -i.bak 's/LOG_LEVEL=info/LOG_LEVEL=debug/' .env
    
    print_success "Development deployment ready!"
    print_info "Start the application with: npm run dev"
    print_info "This will start both frontend (port 3000) and backend (port 3001)"
}

# Main menu
show_menu() {
    echo
    echo "Choose deployment method:"
    echo "1) Traditional (Node.js + PM2)"
    echo "2) Docker Compose"
    echo "3) Docker Compose (Homelab)"
    echo "4) Development Setup"
    echo "5) Exit"
    echo
}

# Health check
check_health() {
    print_info "Checking application health..."
    
    # Wait a moment for the application to start
    sleep 5
    
    # Try to access health endpoint
    if command_exists curl; then
        if curl -s http://localhost:5999/api/health > /dev/null; then
            print_success "Application is healthy!"
            return 0
        else
            print_warning "Health check failed - application may still be starting"
            return 1
        fi
    else
        print_warning "curl not available - cannot perform health check"
        return 1
    fi
}

# Main script
main() {
    print_header
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the project directory?"
        exit 1
    fi
    
    check_prerequisites
    
    # Parse command line arguments
    case "${1:-}" in
        "traditional"|"node"|"pm2")
            deploy_traditional
            check_health
            ;;
        "docker")
            deploy_docker
            check_health
            ;;
        "homelab")
            deploy_docker "homelab"
            check_health
            ;;
        "dev"|"development")
            deploy_development
            ;;
        "health"|"check")
            check_health
            ;;
        *)
            # Interactive mode
            while true; do
                show_menu
                read -p "Enter your choice [1-5]: " choice
                case $choice in
                    1)
                        deploy_traditional
                        check_health
                        break
                        ;;
                    2)
                        deploy_docker
                        check_health
                        break
                        ;;
                    3)
                        deploy_docker "homelab"
                        check_health
                        break
                        ;;
                    4)
                        deploy_development
                        break
                        ;;
                    5)
                        print_info "Goodbye!"
                        exit 0
                        ;;
                    *)
                        print_error "Invalid option. Please choose 1-5."
                        ;;
                esac
            done
            ;;
    esac
    
    echo
    print_success "Deployment script completed!"
}

# Run main function
main "$@"