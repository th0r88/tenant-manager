#!/bin/bash

# Docker Hub Multi-Architecture Build Script
# Usage: ./scripts/docker-build.sh [dev|staging|prod] [version]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-YOUR_USERNAME}"  # Replace with your username
IMAGE_NAME="tenant-manager"
REGISTRY="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Print functions
print_header() {
    echo -e "\n${BLUE}===========================================${NC}"
    echo -e "${BLUE}  Docker Hub Multi-Arch Build Script${NC}"
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

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker buildx version &> /dev/null; then
        print_error "Docker buildx is not available"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    
    print_success "Prerequisites OK"
}

# Get version from package.json
get_version() {
    if [ -f "package.json" ]; then
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    else
        VERSION="1.0.0"
    fi
    echo $VERSION
}

# Build development image (single architecture)
build_dev() {
    print_info "Building development image for current platform..."
    
    # Detect current platform
    PLATFORM=$(docker buildx inspect --bootstrap | grep -E "linux/(amd64|arm64)" | head -1 | awk '{print $1}')
    if [ -z "$PLATFORM" ]; then
        PLATFORM="linux/amd64"
    fi
    
    print_info "Building for platform: $PLATFORM"
    
    docker buildx build \
        --platform $PLATFORM \
        --tag $REGISTRY:dev \
        --load \
        .
    
    print_success "Development build completed: $REGISTRY:dev"
    print_info "Test with: docker run -p 5999:5999 $REGISTRY:dev"
}

# Build staging image (multi-architecture)
build_staging() {
    print_info "Building staging image for multiple architectures..."
    
    docker buildx build \
        --platform linux/amd64,linux/arm64,linux/arm/v7 \
        --tag $REGISTRY:staging \
        --push \
        .
    
    print_success "Staging build completed and pushed: $REGISTRY:staging"
}

# Build production image (multi-architecture with version)
build_prod() {
    local version=${1:-$(get_version)}
    
    print_info "Building production image v$version for multiple architectures..."
    
    # Check if we're on main branch (optional)
    if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
        BRANCH=$(git branch --show-current)
        if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
            print_warning "Not on main branch (current: $BRANCH). Continue? [y/N]"
            read -r response
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                print_info "Build cancelled"
                exit 0
            fi
        fi
    fi
    
    docker buildx build \
        --platform linux/amd64,linux/arm64,linux/arm/v7 \
        --tag $REGISTRY:$version \
        --tag $REGISTRY:latest \
        --push \
        .
    
    print_success "Production build completed and pushed:"
    print_success "  $REGISTRY:$version"
    print_success "  $REGISTRY:latest"
}

# Show build information
show_info() {
    local version=$(get_version)
    
    echo -e "\n${BLUE}Build Information:${NC}"
    echo -e "  Registry: $REGISTRY"
    echo -e "  Version:  $version"
    echo -e "  Branch:   $(git branch --show-current 2>/dev/null || echo 'unknown')"
    echo -e "  Commit:   $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
    echo
}

# Main function
main() {
    print_header
    
    local build_type=${1:-}
    local version=${2:-}
    
    if [ -z "$build_type" ]; then
        echo "Usage: $0 [dev|staging|prod] [version]"
        echo
        echo "Examples:"
        echo "  $0 dev                    # Build development image"
        echo "  $0 staging                # Build staging image"
        echo "  $0 prod                   # Build production image (auto-version)"
        echo "  $0 prod 1.2.3            # Build production image with specific version"
        echo
        exit 1
    fi
    
    check_prerequisites
    show_info
    
    case $build_type in
        "dev"|"development")
            build_dev
            ;;
        "staging"|"stage")
            build_staging
            ;;
        "prod"|"production")
            build_prod "$version"
            ;;
        *)
            print_error "Invalid build type: $build_type"
            print_info "Valid types: dev, staging, prod"
            exit 1
            ;;
    esac
    
    print_success "Build script completed!"
}

# Run main function with all arguments
main "$@"