import json
import os
import yaml
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
import tarfile
import re
from maap.maap import MAAP
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(module)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)
logger.addHandler(ch)
WORKDIR = os.path.dirname(os.path.abspath(__file__))


def get_maap_config(host):
    maap_env = json.load(open(os.path.join(os.path.dirname(os.path.dirname(WORKDIR)), "maap_environments.json")))
    match = next((x for x in maap_env if host in x['ade_server']), None)
    maap_config = next((x for x in maap_env if x['default_host'] == True), None) if match is None else match
    return maap_config


# helper to parse out user-defined inputs when registering algorithm
def parseInputs(popped):
    p1 = [{e['name']: str(e['type']).lower()} for e in
          popped]  # parse {"name":"varname","download":boolean} to {"varname":boolean}, convert boolean to lower
    return {k: v for d in p1 for k, v in d.items()}  # flatten list of dicts to just 1 dict


def build_inputs_request(config):
    json_in_file = os.path.join(WORKDIR, "register_inputs.json")

    with open(json_in_file) as f:
        ins_json = f.read().strip("\n")

    # build inputs json
    popped = config.pop('inputs')
    inputs = parseInputs(popped) if popped is not None else {}

    ins = []
    for name in inputs.keys():
        if len(name) > 0:
            ins.append(ins_json.format(field_name=name, dl=inputs[name]))
    # add inputs json to config for template substitution
    config['algo_inputs'] = ",".join(ins)
    config.update({"ecosml_verified": True})

    json_file = os.path.join(WORKDIR, "register_url.json")
    with open(json_file) as jso:
        req_json = jso.read()
    req_json = req_json.format(**config)
    return req_json


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /ecosml_iframe_extension/get_example endpoint!"
        }))


class VerifyAlgorithmHandler(APIHandler):

    @tornado.web.authenticated
    def get(self):
        # ==================================
        # Part 1: Parse Required Arguments
        # ==================================
        package_path = self.get_argument("packagePath")
        repo_name = self.get_argument("repoName")
        base_dir = os.path.dirname(package_path)
        pattern = r"^.*/(?P<packageName>.*).tar(.gz)?"
        if not os.path.exists(package_path):
            self.send_error(status_code=404, reason=f"dir not found {package_path}")
        match = re.match(pattern, package_path)
        tarfile.open(package_path).extractall()
        package_path = os.path.join(base_dir, match.group("packageName"))
        imgspec_dir = os.path.join(package_path, ".imgspec")
        if not os.path.exists(imgspec_dir):
            self.send_error(status_code=404, reason=f".imgpsec dir not found at {imgspec_dir}")

        algorithm_config = os.path.join(imgspec_dir, "algorithm_config.yaml")
        if not os.path.exists(algorithm_config):
            algorithm_config = os.path.join(imgspec_dir, "algorithm_config.yml")
            if not os.path.exists(algorithm_config):
                self.send_error(status_code=404, reason=f"algorithm_config.yaml not found at {imgspec_dir}")

        config = {}
        with open(algorithm_config, 'r') as stream:
            config = yaml.load(stream)

        if config['description'] in ['null', None]:
            config['description'] = ''
        if config['inputs'] in ['null', None]:
            config['inputs'] = ''
        if config.get("queue") in ['null', None]:
            config['queue'] = ''
        logger.debug('config params are')
        logger.debug(config)

        # only description and inputs are allowed to be empty
        for f in ['algo_name', 'version', 'environment', 'run_command', 'repository_url', 'docker_url']:
            if config.get(f) in [None, '']:
                self.send_error(status_code=412, reason="Error: Register field {} cannot be empty.".format(f))
                return

        if not 'inputs' in config.keys():
            config['inputs'] = {}

        # If no disk_space specified default to 10GB
        config['disk_space'] = config.get("disk_space", "10GB")

        # replace spaces in algorithm name
        config['algo_name'] = config['algo_name'].replace(' ', '_')

        logger.debug('repo url is {}'.format(config['repository_url']))

        # check if repo is hosted on a MAAP GitLab instance
        # if (not ('geospec') in config['repository_url']) and (not ('imgspec') in config['repository_url']):
        #     self.finish({"status_code": 412,
        #                  "result": "Error: Your git repo is not from a supported host (e.g. mas.maap-project.org)"})
        #     return
        req_json = build_inputs_request(config)
        self.write(req_json)
        self.finish()


class RegisterAlgorithmHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        request_json = self.get_json_body()
        print(request_json)
        maap = MAAP(get_maap_config(self.request.host).get("api_server"))
        try:
            r = maap.registerAlgorithm(request_json)
            logger.debug(r.text)
            if r.status_code != 200:
                print('failed')
                self.send_error(status_code=r.status_code, reason=r.reason)
            else:
                self.finish()
        except Exception as e:
            self.send_error(status_code=400, reason=str(e))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "ecosml_iframe_extension", "get_example")
    handlers = [(route_pattern, RouteHandler),
                (url_path_join(base_url, "ecosml_iframe_extension", "verifyAlgorithm"), VerifyAlgorithmHandler),
                (url_path_join(base_url, "ecosml_iframe_extension", "registerAlgorithm"), RegisterAlgorithmHandler)]
    web_app.add_handlers(host_pattern, handlers)


if __name__ == '__main__':
    config = {'algo_name': 'isofit', 'version': 'system-test-3', 'environment': 'ubuntu', 'repository_url': 'https://gitlab.com/geospec/isofit.git', 'docker_url': 'registry.imgspec.org/root/ade_base_images/isofit:latest', 'description': 'Performs atmospheric correction', 'run_command': 'isofit/.imgspec/imgspec_run.sh', 'disk_space': '50GB', 'inputs': [{'name': 'l1_granule', 'type': 'file'}, {'name': 'surface_reflectance_spectra', 'type': 'positional'}, {'name': 'vegetation_reflectance_spectra', 'type': 'positional'}, {'name': 'water_reflectance_spectra', 'type': 'positional'}, {'name': 'snow_and_liquids_reflectance_spectra', 'type': 'positional'}], 'queue': ''}
    print(build_inputs_request(config))

