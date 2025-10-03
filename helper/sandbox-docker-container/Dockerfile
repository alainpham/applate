FROM debian:12

# Install curl and dnsutils (for DNS tools)
RUN apt-get update && apt-get install -y \
    ncurses-term vim curl wget rsync bash-completion dnsutils zip unzip jq\
    && apt-get clean && rm -rf /var/lib/apt/lists/*
CMD ["bash"]