# config valid only for current version of Capistrano
# lock '3.4.0'

# Based on comments for Capistrano without SCM
# https://github.com/capistrano/capistrano/issues/722#issuecomment-30885050

abort "IMAGE_TAG environment variable must be set" unless ENV['IMAGE_TAG']
abort "TROCA_NEW_RELIC_ENABLED environment variable must be set" unless ENV['TROCA_NEW_RELIC_ENABLED']

set :scm, nil
set :application, 'payment-api'
set :docker_registry, '273512012034.dkr.ecr.us-east-1.amazonaws.com'
set :docker_registry_application, 'payment-api'
set :docker_log_mapping, '/var/log/trocafone:/opt/payment-api/logs'
set :docker_registry_application_tag, ENV['IMAGE_TAG']
set :new_relic_enabled, ENV['TROCA_NEW_RELIC_ENABLED'] || 'false'
set :container_name, -> { fetch(:stage) + '-' + fetch(:application)}
set :registry_url, -> { fetch(:docker_registry) + '/' + fetch(:docker_registry_application) + ':' +  fetch(:docker_registry_application_tag)}


namespace :ecr do
    desc "Login to our Amazon ECR repo"
    task :login do
        on roles(:api, :worker) do
            execute "`aws ecr get-login --region us-east-1 --no-include-email`"
        end
    end
end

namespace :payment do
    desc "Run the image"
    task :run do
        on roles(:api) do
            execute "docker run -d #{fetch(:docker_extra_options)} --name '#{fetch(:container_name)}' -v #{fetch(:docker_log_mapping)} -e 'TROCA_NEW_RELIC_ENABLED=#{fetch(:new_relic_enabled)}' -p 0.0.0.0:80:80 #{fetch(:registry_url)} start #{fetch(:stage)}"
            sleep 5 # Let's wait for the thing to start up
        end
    end

    # desc "Request version"
    # task :req_version do
    #     on roles(:api) do
    #         execute "curl -XGET http://localhost/utils/version"
    #     end
    # end

    desc "Pull the latest image"
    task :pull do
        on roles(:api) do
            execute "docker pull #{fetch(:registry_url)}"
        end
    end

    desc "Stop and remove the currently running container"
    task :remove do
        on roles(:api) do
            execute "docker stop #{fetch(:container_name)} && docker rm #{fetch(:container_name)} || true"
        end
    end
end

after "deploy:started", "ecr:login"
after "deploy:started", "payment:pull"
after "deploy:started", "payment:remove"
after "deploy:started", "payment:run"
# after "payment:run", "payment:req_version"
